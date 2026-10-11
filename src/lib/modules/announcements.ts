import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Announcement, AnnouncementOutboxMessage, AnnouncementPublication, PublishAnnouncementInput } from "../contracts";
import { clubDate, int, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { MEMBERSHIP_ACTIVE_SQL } from "./membership-state";
import type { WhatsAppModule } from "./whatsapp";

export const publishAnnouncementSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000),
}).strict();

function mapAnnouncement(row: Row): Announcement {
  return { id: text(row.id), title: text(row.title), body: text(row.body), publishedAt: text(row.published_at) };
}

export function createAnnouncementsModule(ctx: DbContext, identity: IdentityModule, whatsapp?: WhatsAppModule) {
  const { db } = ctx;

  function requireRow(clubId: string, id: string): Row {
    const row = db.prepare("SELECT * FROM announcements WHERE club_id = ? AND id = ?").get(clubId, id) as Row | undefined;
    if (!row) throw new NotFoundError("Announcement not found.");
    return row;
  }

  function listPublished(clubId: string): Announcement[] {
    return (db.prepare("SELECT * FROM announcements WHERE club_id = ? ORDER BY published_at DESC, id").all(clubId) as Row[]).map(mapAnnouncement);
  }

  function getPublished(clubId: string, id: string): Announcement {
    return mapAnnouncement(requireRow(clubId, id));
  }

  /** One write lock covers the membership snapshot, publication, both deliveries and audit. */
  function publish(actor: Actor, input: PublishAnnouncementInput): AnnouncementPublication {
    assertPermission(actor, "announcements:write");
    const data = parseInput(publishAnnouncementSchema, input);
    return transaction(ctx, () => {
      const existing = db.prepare("SELECT * FROM announcements WHERE club_id = ? AND idempotency_key = ?")
        .get(actor.clubId, data.idempotencyKey) as Row | undefined;
      if (existing) {
        if (existing.title !== data.title || existing.body !== data.body) {
          throw new ConflictError("This publication key was already used for different content.", "announcement_key_reused");
        }
        // Never recalculate recipients on retry: membership may have changed since publication.
        return { announcement: mapAnnouncement(existing), created: false, recipientCount: int(existing.recipient_count), delivery: "simulated" };
      }

      const now = ctx.now();
      const publishedAt = now.toISOString();
      const recipients = db.prepare(`SELECT id, email FROM members WHERE club_id = ? AND left_at IS NULL AND ${MEMBERSHIP_ACTIVE_SQL} ORDER BY id`)
        .all(actor.clubId, clubDate(now)) as Row[];
      const id = randomUUID();
      db.prepare(`INSERT INTO announcements (id, club_id, title, body, published_at, published_by, idempotency_key, recipient_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, actor.clubId, data.title, data.body, publishedAt, actor.memberId, data.idempotencyKey, recipients.length);
      const notify = db.prepare(`INSERT INTO notifications (id, club_id, member_id, kind, title, body, created_at, read_at, announcement_id)
        VALUES (?, ?, ?, 'announcement', ?, ?, ?, NULL, ?)`);
      const outbox = db.prepare(`INSERT INTO outbox_messages (id, club_id, member_id, kind, recipient_email, subject, body, status, created_at, announcement_id)
        VALUES (?, ?, ?, 'announcement', ?, ?, ?, 'simulated', ?, ?)`);
      for (const recipient of recipients) {
        outbox.run(randomUUID(), actor.clubId, text(recipient.id), text(recipient.email), data.title, data.body, publishedAt, id);
        notify.run(randomUUID(), actor.clubId, text(recipient.id), data.title, data.body, publishedAt, id);
      }
      whatsapp?.queueAnnouncement(actor.clubId, id, data.title, data.body, recipients.map((recipient) => text(recipient.id)));
      identity.recordAudit(actor, "announcement.published", "announcement", id, { recipientCount: recipients.length, delivery: "simulated" });
      return { announcement: getPublished(actor.clubId, id), created: true, recipientCount: recipients.length, delivery: "simulated" };
    });
  }

  function inspectOutbox(actor: Actor, id: string): { delivery: "simulated"; messages: AnnouncementOutboxMessage[] } {
    assertPermission(actor, "outbox:manage");
    requireRow(actor.clubId, id);
    const rows = db.prepare("SELECT * FROM outbox_messages WHERE club_id = ? AND announcement_id = ? ORDER BY created_at, id")
      .all(actor.clubId, id) as Row[];
    return {
      delivery: "simulated",
      messages: rows.map((row) => ({
        id: text(row.id), announcementId: text(row.announcement_id), memberId: text(row.member_id),
        recipientEmail: text(row.recipient_email), subject: text(row.subject), body: text(row.body),
        status: "simulated", createdAt: text(row.created_at),
      })),
    };
  }

  return { listPublished, getPublished, publish, inspectOutbox };
}
