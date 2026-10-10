import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DuesPayment, ExpiringMember, Notification } from "../contracts";
import { addDays, clubDate, int, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { DEFAULT_CLUB_ID } from "../db/migrations";
import { ConflictError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { SOURCE_RESOLVERS, postLedgerEntry } from "./ledger";
import { MEMBERSHIP_STATE_SQL, membershipState } from "./membership-state";

export const MEMBERSHIP_DAYS = 365;
export const REMINDER_WINDOW_DAYS = 30;

export const recordDuesSchema = z.object({ memberId: z.string().min(1), reference: z.string().trim().min(3).max(120) }).strict();
export const expiringQuerySchema = z.object({ days: z.coerce.number().int().min(0).max(365).default(REMINDER_WINDOW_DAYS) }).strict();

SOURCE_RESOLVERS.dues_payment = (db, sourceId) => db.prepare("SELECT 1 FROM dues_payments WHERE id = ?").get(sourceId) !== undefined;

function mapPayment(row: Row): DuesPayment {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    reference: text(row.reference),
    amountPaise: int(row.amount_paise),
    previousExpiresOn: nullableText(row.previous_expires_on),
    newExpiresOn: text(row.new_expires_on),
    recordedBy: text(row.recorded_by),
    recordedAt: text(row.recorded_at),
  };
}

/** Membership dues (P1, #4): officer-recorded, club-priced, ledger-bound, reminder-tracked. */
export function createDuesModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;

  function duesAmount(clubId: string): number {
    const row = db.prepare("SELECT annual_dues_paise FROM clubs WHERE id = ?").get(clubId) as Row | undefined;
    if (!row) throw new NotFoundError("Club not found.");
    return int(row.annual_dues_paise);
  }

  /** First payment: today + 365. Renewal: max(today, current expiry) + 365, so paying early never loses days. */
  function nextExpiry(currentExpiresOn: string | null, today: string): string {
    const base = currentExpiresOn && currentExpiresOn > today ? currentExpiresOn : today;
    return addDays(base, MEMBERSHIP_DAYS);
  }

  function recordDues(actor: Actor, input: z.infer<typeof recordDuesSchema>): { payment: DuesPayment; created: boolean; membership: ReturnType<typeof membershipState>; expiresOn: string } {
    assertPermission(actor, "membership:record_payment");
    const data = parseInput(recordDuesSchema, input);
    return transaction(ctx, () => {
      const member = identity.requireMember(actor.clubId, data.memberId);
      const existing = db.prepare("SELECT * FROM dues_payments WHERE club_id = ? AND reference = ?").get(actor.clubId, data.reference) as Row | undefined;
      if (existing) {
        if (text(existing.member_id) !== member.id) throw new ConflictError("This payment reference belongs to a different member.", "payment_reference_reused");
        // Duplicate recording: same answer, no second credit.
        const current = identity.requireMember(actor.clubId, member.id);
        return { payment: mapPayment(existing), created: false, membership: current.membership, expiresOn: current.expiresOn! };
      }
      const today = clubDate(ctx.now());
      const amountPaise = duesAmount(actor.clubId);
      const newExpiresOn = nextExpiry(member.expiresOn, today);
      const id = randomUUID();
      const recordedAt = ctx.now().toISOString();
      db.prepare(
        "INSERT INTO dues_payments (id, club_id, member_id, reference, amount_paise, previous_expires_on, new_expires_on, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(id, actor.clubId, member.id, data.reference, amountPaise, member.expiresOn, newExpiresOn, actor.memberId, recordedAt);
      db.prepare("UPDATE members SET expires_on = ?, dues_status = 'paid' WHERE id = ?").run(newExpiresOn, member.id);
      postLedgerEntry(ctx, {
        kind: "income",
        amountPaise,
        description: `Membership dues · ${member.name} · valid to ${newExpiresOn}`,
        source: { type: "dues_payment", id },
        recordedBy: actor.memberId,
      });
      identity.recordAudit(actor, "dues.recorded", "dues_payment", id, { memberId: member.id, reference: data.reference, amountPaise, newExpiresOn });
      const payment = mapPayment(db.prepare("SELECT * FROM dues_payments WHERE id = ?").get(id) as Row);
      return { payment, created: true, membership: membershipState({ expiresOn: newExpiresOn }, today), expiresOn: newExpiresOn };
    });
  }

  function paymentsFor(clubId: string, memberId: string): DuesPayment[] {
    return (db.prepare("SELECT * FROM dues_payments WHERE club_id = ? AND member_id = ? ORDER BY recorded_at DESC").all(clubId, memberId) as Row[]).map(mapPayment);
  }

  /** Members whose membership ends within `days` club days (still active today). */
  function expiringWithin(actor: Actor, days: number = REMINDER_WINDOW_DAYS): ExpiringMember[] {
    assertPermission(actor, "members:read");
    const today = clubDate(ctx.now());
    const horizon = addDays(today, days);
    return (
      db
        .prepare(
          `SELECT id, name, email, expires_on, ${MEMBERSHIP_STATE_SQL} AS state FROM members
           WHERE club_id = ? AND expires_on IS NOT NULL AND expires_on BETWEEN ? AND ? ORDER BY expires_on, name COLLATE NOCASE`,
        )
        .all(today, actor.clubId, today, horizon) as Row[]
    ).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      email: text(row.email),
      expiresOn: text(row.expires_on),
      daysLeft: Math.round((Date.parse(`${text(row.expires_on)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000),
    }));
  }

  /**
   * One reminder per member per expiry date: an in-app notification plus a simulated
   * outbox row. UNIQUE(member_id, expires_on) makes repeated runs a no-op.
   */
  function sendRenewalReminders(actor: Actor, days: number = REMINDER_WINDOW_DAYS) {
    assertPermission(actor, "membership:reminders");
    const due = expiringWithin({ ...actor, role: actor.role }, days);
    let sent = 0;
    let skipped = 0;
    transaction(ctx, () => {
      const claim = db.prepare("INSERT OR IGNORE INTO membership_reminders (member_id, expires_on, club_id, sent_at) VALUES (?, ?, ?, ?)");
      const notify = db.prepare("INSERT INTO notifications (id, club_id, member_id, kind, title, body, created_at, read_at) VALUES (?, ?, ?, 'membership_renewal', ?, ?, ?, NULL)");
      const outbox = db.prepare("INSERT INTO outbox_messages (id, club_id, member_id, kind, recipient_email, subject, body, status, created_at) VALUES (?, ?, ?, 'membership_renewal', ?, ?, ?, 'simulated', ?)");
      for (const member of due) {
        const nowIso = ctx.now().toISOString();
        if (Number(claim.run(member.id, member.expiresOn, actor.clubId, nowIso).changes) === 0) {
          skipped += 1;
          continue;
        }
        const title = `Your membership ends on ${member.expiresOn}`;
        const body = `Hi ${member.name}, your club membership ends in ${member.daysLeft} day(s). Renew with any officer to keep member pricing.`;
        notify.run(randomUUID(), actor.clubId, member.id, title, body, nowIso);
        outbox.run(randomUUID(), actor.clubId, member.id, member.email, title, body, nowIso);
        sent += 1;
      }
    });
    return { asOf: clubDate(ctx.now()), windowDays: days, candidates: due.length, sent, skipped };
  }

  function notificationsFor(actor: Actor): Notification[] {
    return (db.prepare("SELECT * FROM notifications WHERE club_id = ? AND member_id = ? ORDER BY created_at DESC").all(actor.clubId, actor.memberId) as Row[]).map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      title: text(row.title),
      body: text(row.body),
      createdAt: text(row.created_at),
      readAt: nullableText(row.read_at),
    }));
  }

  function simulatedOutbox(actor: Actor) {
    assertPermission(actor, "membership:reminders");
    return (db.prepare("SELECT id, kind, subject, status, created_at FROM outbox_messages WHERE club_id = ? ORDER BY created_at DESC").all(actor.clubId) as Row[]).map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      subject: text(row.subject),
      status: text(row.status),
      createdAt: text(row.created_at),
    }));
  }

  return { duesAmount: () => duesAmount(DEFAULT_CLUB_ID), recordDues, paymentsFor, expiringWithin, sendRenewalReminders, notificationsFor, simulatedOutbox, nextExpiry };
}

export type DuesModule = ReturnType<typeof createDuesModule>;
