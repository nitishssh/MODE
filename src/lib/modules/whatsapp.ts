import { randomUUID } from "node:crypto";
import { z } from "zod";
import { text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { WhatsAppDelivery, WhatsAppGroup, WhatsAppPreference, WhatsAppStatus } from "../contracts";

export const whatsappPreferenceSchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use an international number such as +919876543210.").nullable(),
  enabled: z.boolean(),
}).strict().refine((value) => !value.enabled || value.phone !== null, { message: "Add a phone number to enable notifications.", path: ["phone"] });

// Store the provider's opaque group identifier; do not assume another OpenWA project's addressing format.
export const whatsappGroupSchema = z.object({
  destination: z.string().trim().min(1).max(256).regex(/^\S+$/).nullable(),
  enabled: z.boolean(),
}).strict().refine((value) => !value.enabled || value.destination !== null, { message: "Add a group destination first.", path: ["destination"] });

export interface WhatsAppClaim {
  id: string; clubId: string; token: string; destination: string; body: string; audience: "member" | "group";
}
export type WhatsAppOutcome =
  | { status: "accepted"; messageId: string }
  | { status: "failed"; code: "provider_rejected" }
  | { status: "uncertain"; code: "submission_unknown" };

export const WHATSAPP_CLAIM_TTL_MS = 120_000;
const MAX_ATTEMPTS = 3;

export function createWhatsAppModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;
  function preferences(actor: Actor): WhatsAppPreference {
    identity.requireMember(actor.clubId, actor.memberId);
    const row = db.prepare("SELECT phone, enabled FROM whatsapp_preferences WHERE club_id = ? AND member_id = ?").get(actor.clubId, actor.memberId);
    return { phone: row?.phone ? text(row.phone) : null, enabled: row?.enabled === 1 };
  }
  function savePreferences(actor: Actor, input: WhatsAppPreference) {
    const value = parseInput(whatsappPreferenceSchema, input);
    return transaction(ctx, () => {
      identity.requireMember(actor.clubId, actor.memberId);
      const now = ctx.now().toISOString();
      db.prepare(`INSERT INTO whatsapp_preferences (member_id, club_id, phone, enabled, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (member_id) DO UPDATE SET phone = excluded.phone, enabled = excluded.enabled, updated_at = excluded.updated_at`)
        .run(actor.memberId, actor.clubId, value.phone, Number(value.enabled), now);
      // Cancel stale pending destinations immediately, including when the number changes.
      db.prepare(`UPDATE whatsapp_deliveries SET status = 'cancelled', updated_at = ?, error_code = 'preference_changed'
        WHERE club_id = ? AND member_id = ? AND status = 'pending' AND (? = 0 OR destination <> ?)`)
        .run(now, actor.clubId, actor.memberId, Number(value.enabled), value.phone ?? "");
      identity.recordAudit(actor, "whatsapp.preferences_updated", "member", actor.memberId, { enabled: value.enabled });
      return value;
    });
  }
  function group(actor: Actor): WhatsAppGroup {
    assertPermission(actor, "outbox:manage");
    const row = db.prepare("SELECT destination, enabled FROM whatsapp_groups WHERE club_id = ?").get(actor.clubId);
    return { destination: row?.destination ? text(row.destination) : null, enabled: row?.enabled === 1 };
  }
  function saveGroup(actor: Actor, input: WhatsAppGroup) {
    assertPermission(actor, "outbox:manage");
    const value = parseInput(whatsappGroupSchema, input);
    return transaction(ctx, () => {
      const now = ctx.now().toISOString();
      db.prepare(`INSERT INTO whatsapp_groups (club_id, destination, enabled, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (club_id) DO UPDATE SET destination = excluded.destination, enabled = excluded.enabled, updated_at = excluded.updated_at`)
        .run(actor.clubId, value.destination, Number(value.enabled), now);
      db.prepare(`UPDATE whatsapp_deliveries SET status = 'cancelled', updated_at = ?, error_code = 'group_changed'
        WHERE club_id = ? AND audience = 'group' AND status = 'pending' AND (? = 0 OR destination <> ?)`)
        .run(now, actor.clubId, Number(value.enabled), value.destination ?? "");
      identity.recordAudit(actor, "whatsapp.group_updated", "club", actor.clubId, { enabled: value.enabled });
      return value;
    });
  }
  function enqueue(clubId: string, source: string, kind: string, memberId: string | null, destination: string, body: string) {
    const now = ctx.now().toISOString();
    db.prepare(`INSERT OR IGNORE INTO whatsapp_deliveries
      (id, club_id, source_key, kind, audience, member_id, destination, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), clubId, source, kind, memberId ? "member" : "group", memberId, destination, body, now, now);
  }
  function enqueueMember(clubId: string, source: string, kind: string, memberId: string, body: string) {
    const pref = db.prepare("SELECT phone FROM whatsapp_preferences WHERE club_id = ? AND member_id = ? AND enabled = 1").get(clubId, memberId);
    if (pref?.phone) enqueue(clubId, source, kind, memberId, text(pref.phone), body);
  }
  // Called inside the domain transaction: no network work or delivery claims here.
  function queueAnnouncement(clubId: string, id: string, title: string, body: string, members: string[]) {
    const message = `${title}\n\n${body}`;
    const source = `announcement:${id}`;
    const target = db.prepare("SELECT destination FROM whatsapp_groups WHERE club_id = ? AND enabled = 1").get(clubId);
    if (target?.destination) enqueue(clubId, source, "announcement", null, text(target.destination), message);
    for (const member of members) enqueueMember(clubId, source, "announcement", member, message);
  }
  function queueRenewal(clubId: string, memberId: string, expiresOn: string, title: string, body: string) {
    enqueueMember(clubId, `renewal:${memberId}:${expiresOn}`, "membership_renewal", memberId, `${title}\n\n${body}`);
  }
  function list(actor: Actor): WhatsAppDelivery[] {
    assertPermission(actor, "outbox:manage");
    return db.prepare(`SELECT id, kind, audience, status, attempts, created_at, updated_at, error_code
      FROM whatsapp_deliveries WHERE club_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(actor.clubId).map((row) => ({
      id: text(row.id), kind: row.kind as WhatsAppDelivery["kind"], audience: row.audience as WhatsAppDelivery["audience"],
      status: row.status as WhatsAppStatus, attempts: Number(row.attempts), createdAt: text(row.created_at),
      updatedAt: text(row.updated_at), errorCode: row.error_code === null ? null : text(row.error_code),
    }));
  }
  function eligible(row: Row) {
    if (row.audience === "group") return !!db.prepare("SELECT 1 FROM whatsapp_groups WHERE club_id = ? AND enabled = 1 AND destination = ?").get(row.club_id, row.destination);
    return !!db.prepare("SELECT 1 FROM whatsapp_preferences WHERE club_id = ? AND member_id = ? AND enabled = 1 AND phone = ?").get(row.club_id, row.member_id, row.destination);
  }
  /** Worker-only operation. Expired claims become uncertain; they are never auto-resubmitted. */
  function claimNext(clubId: string): WhatsAppClaim | null {
    return transaction(ctx, () => {
      const now = ctx.now().toISOString();
      db.prepare(`UPDATE whatsapp_deliveries SET status = 'uncertain', error_code = 'claim_expired', updated_at = ?
        WHERE club_id = ? AND status = 'sending' AND claimed_at <= ?`)
        .run(now, clubId, new Date(ctx.now().getTime() - WHATSAPP_CLAIM_TTL_MS).toISOString());
      // Bounded scan: cancelled entries cannot starve later runs.
      const rows = db.prepare("SELECT * FROM whatsapp_deliveries WHERE club_id = ? AND status = 'pending' ORDER BY created_at, id LIMIT 100").all(clubId);
      for (const row of rows) {
        if (!eligible(row)) {
          db.prepare("UPDATE whatsapp_deliveries SET status = 'cancelled', error_code = 'destination_disabled', updated_at = ? WHERE id = ? AND status = 'pending'").run(now, row.id);
          continue;
        }
        const token = randomUUID();
        const updated = db.prepare(`UPDATE whatsapp_deliveries SET status = 'sending', attempts = attempts + 1,
          claim_token = ?, claimed_at = ?, updated_at = ?, error_code = NULL WHERE id = ? AND status = 'pending'`)
          .run(token, now, now, row.id);
        if (!Number(updated.changes)) continue;
        return { id: text(row.id), clubId, token, destination: text(row.destination), body: text(row.body), audience: row.audience as "member" | "group" };
      }
      return null;
    });
  }
  function settle(claim: WhatsAppClaim, outcome: WhatsAppOutcome) {
    const changed = db.prepare(`UPDATE whatsapp_deliveries SET status = ?, provider_message_id = ?, error_code = ?, updated_at = ?
      WHERE id = ? AND club_id = ? AND status = 'sending' AND claim_token = ?`)
      .run(outcome.status, outcome.status === "accepted" ? outcome.messageId : null,
        outcome.status === "accepted" ? null : outcome.code, ctx.now().toISOString(), claim.id, claim.clubId, claim.token);
    return Number(changed.changes) === 1;
  }
  function retry(actor: Actor, id: string) {
    assertPermission(actor, "outbox:manage");
    return transaction(ctx, () => {
      const result = db.prepare(`UPDATE whatsapp_deliveries SET status = 'pending', error_code = NULL, updated_at = ?
        WHERE club_id = ? AND id = ? AND status = 'failed' AND attempts < ?`)
        .run(ctx.now().toISOString(), actor.clubId, id, MAX_ATTEMPTS);
      if (!Number(result.changes)) throw new ConflictError("Only confirmed failed messages with fewer than three attempts can be retried.", "whatsapp_retry_unavailable");
      identity.recordAudit(actor, "whatsapp.retry_requested", "whatsapp_delivery", id, {});
      return { queued: true as const };
    });
  }
  return { preferences, savePreferences, group, saveGroup, queueAnnouncement, queueRenewal, list, claimNext, settle, retry };
}
export type WhatsAppModule = ReturnType<typeof createWhatsAppModule>;
