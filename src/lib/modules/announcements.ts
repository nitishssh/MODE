import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Announcement, AnnouncementDetails, DeliverySummary } from "../contracts";
import { nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { MembershipModule } from "./membership";
import { mailTransport, type OutboxModule } from "./outbox";

export const ANNOUNCEMENT_KIND = "announcement";

export const announcementInputSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(1).max(10000),
    audience: z.enum(["all", "active"]).default("all"),
  })
  .strict();
export const announcementUpdateSchema = announcementInputSchema.partial().strict();
export const publishSchema = z.object({ audience: z.enum(["all", "active"]).optional() }).strict();

function mapDetails(row: Row): AnnouncementDetails {
  return {
    id: text(row.id),
    title: text(row.title),
    body: text(row.body),
    status: row.status as AnnouncementDetails["status"],
    audience: row.audience as AnnouncementDetails["audience"],
    createdBy: nullableText(row.created_by),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    publishedAt: nullableText(row.published_at),
  };
}

export function createAnnouncementsModule(
  ctx: DbContext,
  identity: IdentityModule,
  membership: MembershipModule,
  outbox: OutboxModule,
) {
  const { db } = ctx;

  /** Public, dated history. Drafts never appear here. */
  function listPublished(clubId: string): Announcement[] {
    return (
      db.prepare("SELECT id, title, body, published_at FROM announcements WHERE club_id = ? AND status = 'published' ORDER BY published_at DESC, id").all(clubId) as Row[]
    ).map((row) => ({ id: text(row.id), title: text(row.title), body: text(row.body), publishedAt: text(row.published_at) }));
  }

  function listAll(actor: Actor): AnnouncementDetails[] {
    assertPermission(actor, "announcements:write");
    return (db.prepare("SELECT * FROM announcements WHERE club_id = ? ORDER BY COALESCE(published_at, updated_at) DESC, id").all(actor.clubId) as Row[]).map(mapDetails);
  }

  function requireAnnouncement(clubId: string, id: string): AnnouncementDetails {
    const row = db.prepare("SELECT * FROM announcements WHERE club_id = ? AND id = ?").get(clubId, id) as Row | undefined;
    if (!row) throw new NotFoundError("Announcement not found.");
    return mapDetails(row);
  }

  function createDraft(actor: Actor, input: z.infer<typeof announcementInputSchema>): AnnouncementDetails {
    assertPermission(actor, "announcements:write");
    const data = parseInput(announcementInputSchema, input);
    const id = randomUUID();
    const nowIso = ctx.now().toISOString();
    db.prepare(
      "INSERT INTO announcements (id, club_id, title, body, status, audience, created_by, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, NULL)",
    ).run(id, actor.clubId, data.title, data.body, data.audience, actor.memberId, nowIso, nowIso);
    identity.recordAudit(actor, "announcement.drafted", "announcement", id, { title: data.title });
    return requireAnnouncement(actor.clubId, id);
  }

  /** Drafts are editable; a published announcement is part of the archive and stays as sent. */
  function updateDraft(actor: Actor, id: string, input: z.infer<typeof announcementUpdateSchema>): AnnouncementDetails {
    assertPermission(actor, "announcements:write");
    const data = parseInput(announcementUpdateSchema, input);
    return transaction(ctx, () => {
      const current = requireAnnouncement(actor.clubId, id);
      if (current.status !== "draft") throw new ConflictError("Published announcements cannot be edited; publish a correction instead.", "announcement_published");
      const next = { ...current, ...data };
      db.prepare("UPDATE announcements SET title = ?, body = ?, audience = ?, updated_at = ? WHERE id = ?").run(next.title, next.body, next.audience, ctx.now().toISOString(), id);
      identity.recordAudit(actor, "announcement.updated", "announcement", id, data);
      return requireAnnouncement(actor.clubId, id);
    });
  }

  /** Members who should receive a publication. Addresses stay server-side. */
  function eligibleRecipients(clubId: string, audience: AnnouncementDetails["audience"]): Array<{ id: string; name: string; email: string }> {
    const members = identity.getMembers(clubId);
    return members
      .filter((member) => audience === "all" || membership.statusFor(clubId, member.id).active)
      .map((member) => ({ id: member.id, name: member.name, email: member.email }));
  }

  /**
   * Publish once and queue one outbox message per eligible member. Re-publishing is
   * safe: the announcement keeps its original `publishedAt` and the dedupe key
   * `announcement:<id>:<memberId>` prevents any member from being queued twice.
   */
  function publish(actor: Actor, id: string, input: z.infer<typeof publishSchema> = {}) {
    assertPermission(actor, "announcements:write");
    const data = parseInput(publishSchema, input);
    return transaction(ctx, () => {
      const current = requireAnnouncement(actor.clubId, id);
      const audience = data.audience ?? current.audience;
      const nowIso = ctx.now().toISOString();
      const firstPublish = current.status === "draft";
      if (firstPublish) {
        db.prepare("UPDATE announcements SET status = 'published', audience = ?, published_at = ?, updated_at = ? WHERE id = ?").run(audience, nowIso, nowIso, id);
      }
      let queued = 0;
      let alreadyQueued = 0;
      for (const recipient of eligibleRecipients(actor.clubId, audience)) {
        const added = outbox.enqueue({
          clubId: actor.clubId,
          kind: ANNOUNCEMENT_KIND,
          recipientMemberId: recipient.id,
          recipientEmail: recipient.email,
          subject: current.title,
          body: `Hi ${recipient.name},\n\n${current.body}\n\n— Sent to club members. Read the archive on the club website.`,
          dedupeKey: `announcement:${id}:${recipient.id}`,
          referenceId: id,
        });
        if (added) queued += 1;
        else alreadyQueued += 1;
      }
      identity.recordAudit(actor, firstPublish ? "announcement.published" : "announcement.republished", "announcement", id, { audience, queued, alreadyQueued });
      return { announcement: requireAnnouncement(actor.clubId, id), firstPublish, delivery: deliverySummary(actor, id), queued, alreadyQueued };
    });
  }

  function deliverySummary(actor: Actor, id: string): DeliverySummary {
    assertPermission(actor, "announcements:write");
    requireAnnouncement(actor.clubId, id);
    const counts = outbox.countByReference(actor.clubId, ANNOUNCEMENT_KIND, id);
    return { announcementId: id, transport: mailTransport(), ...counts };
  }

  return { listPublished, listAll, requireAnnouncement, createDraft, updateDraft, publish, deliverySummary, eligibleRecipients };
}

export type AnnouncementsModule = ReturnType<typeof createAnnouncementsModule>;
