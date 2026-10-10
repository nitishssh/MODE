import { randomUUID } from "node:crypto";
import type { OutboxMessage } from "../contracts";
import { SQLITE_CONSTRAINT_UNIQUE, int, isConstraintError, nullableText, text, type DbContext, type Row } from "../db/core";
import { assertPermission, type Actor } from "./identity";

export interface EnqueueInput {
  clubId: string;
  kind: string;
  recipientMemberId: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  /** Stable key per logical message so retries and repeated triggers never duplicate a send. */
  dedupeKey: string;
  /** Optional id of the record this message belongs to (e.g. announcement id). */
  referenceId?: string | null;
}

/**
 * Delivery transports. `preview` (default) only marks messages as previewed.
 * `webhook` POSTs each message as JSON to MODE_MAIL_WEBHOOK_URL (a mail relay such as
 * a Zapier/Make/Resend bridge or the club's own script) and records `sent` only on a
 * 2xx response. Nothing is ever reported as sent without a real transport.
 */
export type MailTransport = "preview" | "webhook";

export function mailTransport(): MailTransport {
  return process.env.MODE_MAIL_TRANSPORT === "webhook" && process.env.MODE_MAIL_WEBHOOK_URL ? "webhook" : "preview";
}

export interface WebhookDelivery {
  (payload: { id: string; kind: string; to: string; subject: string; body: string }): Promise<{ ok: boolean; error?: string }>;
}

async function postToWebhook(payload: { id: string; kind: string; to: string; subject: string; body: string }): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.MODE_MAIL_WEBHOOK_URL!;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.MODE_MAIL_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.MODE_MAIL_WEBHOOK_TOKEN}`;
  try {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
    if (response.ok) return { ok: true };
    return { ok: false, error: `Relay responded ${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Relay unreachable" };
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function mapMessage(row: Row): OutboxMessage {
  return {
    id: text(row.id),
    kind: text(row.kind),
    recipient: maskEmail(text(row.recipient_email)),
    subject: text(row.subject),
    status: row.status as OutboxMessage["status"],
    attempts: int(row.attempts),
    lastError: nullableText(row.last_error),
    createdAt: text(row.created_at),
    deliveredAt: nullableText(row.delivered_at),
  };
}

export function createOutboxModule(ctx: DbContext) {
  const { db } = ctx;

  /** Returns true when a new message was queued, false when the dedupe key already existed. */
  function enqueue(input: EnqueueInput): boolean {
    try {
      db.prepare(
        `INSERT INTO outbox_messages (id, club_id, kind, recipient_member_id, recipient_email, subject, body, dedupe_key, status, attempts, last_error, created_at, delivered_at, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, NULL, ?)`,
      ).run(
        randomUUID(),
        input.clubId,
        input.kind,
        input.recipientMemberId,
        input.recipientEmail,
        input.subject,
        input.body,
        input.dedupeKey,
        ctx.now().toISOString(),
        input.referenceId ?? null,
      );
      return true;
    } catch (error) {
      if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) return false;
      throw error;
    }
  }

  function list(actor: Actor, filter: { kind?: string; status?: OutboxMessage["status"] } = {}): OutboxMessage[] {
    assertPermission(actor, "outbox:manage");
    const clauses = ["club_id = ?"];
    const params: Array<string> = [actor.clubId];
    if (filter.kind) {
      clauses.push("kind = ?");
      params.push(filter.kind);
    }
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    return (
      db.prepare(`SELECT * FROM outbox_messages WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id`).all(...params) as Row[]
    ).map(mapMessage);
  }

  /** Officer-only preview of one message body, for the local demo outbox screen. */
  function preview(actor: Actor, id: string): (OutboxMessage & { body: string; transport: string }) | null {
    assertPermission(actor, "outbox:manage");
    const row = db.prepare("SELECT * FROM outbox_messages WHERE club_id = ? AND id = ?").get(actor.clubId, id) as Row | undefined;
    return row ? { ...mapMessage(row), body: text(row.body), transport: mailTransport() } : null;
  }

  /**
   * Attempt delivery for queued messages. Preview transport: each message becomes
   * `previewed`, never `sent`. Webhook transport: each message is handed to the relay
   * and becomes `sent` on success or `failed` (with the reason) for a later retry.
   * Retries pick up only `pending`/`failed` rows, so a message is never delivered twice.
   */
  async function dispatch(
    actor: Actor,
    options: { limit?: number; maxAttempts?: number; deliver?: WebhookDelivery } = {},
  ): Promise<{ transport: MailTransport; previewed: number; sent: number; failed: number; remaining: number }> {
    assertPermission(actor, "outbox:manage");
    const limit = options.limit ?? 100;
    const maxAttempts = options.maxAttempts ?? 5;
    const transport = mailTransport();
    const due = db
      .prepare(
        "SELECT * FROM outbox_messages WHERE club_id = ? AND status IN ('pending', 'failed') AND attempts < ? ORDER BY created_at, id LIMIT ?",
      )
      .all(actor.clubId, maxAttempts, limit) as Row[];
    const result = { transport, previewed: 0, sent: 0, failed: 0, remaining: 0 };
    if (transport === "preview") {
      const update = db.prepare(
        "UPDATE outbox_messages SET status = 'previewed', attempts = attempts + 1, last_error = NULL, delivered_at = ? WHERE id = ? AND status IN ('pending', 'failed')",
      );
      for (const row of due) result.previewed += Number(update.run(ctx.now().toISOString(), text(row.id)).changes);
    } else {
      const deliver = options.deliver ?? postToWebhook;
      const markSent = db.prepare("UPDATE outbox_messages SET status = 'sent', attempts = attempts + 1, last_error = NULL, delivered_at = ? WHERE id = ?");
      const markFailed = db.prepare("UPDATE outbox_messages SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?");
      for (const row of due) {
        const outcome = await deliver({ id: text(row.id), kind: text(row.kind), to: text(row.recipient_email), subject: text(row.subject), body: text(row.body) });
        if (outcome.ok) {
          markSent.run(ctx.now().toISOString(), text(row.id));
          result.sent += 1;
        } else {
          markFailed.run((outcome.error ?? "Delivery failed").slice(0, 500), text(row.id));
          result.failed += 1;
        }
      }
    }
    result.remaining = countPending(actor.clubId);
    return result;
  }

  /** Delivery counts for one referenced record, without exposing recipients. */
  function countByReference(clubId: string, kind: string, referenceId: string) {
    const rows = db
      .prepare("SELECT status, COUNT(*) AS n FROM outbox_messages WHERE club_id = ? AND kind = ? AND reference_id = ? GROUP BY status")
      .all(clubId, kind, referenceId) as Row[];
    const byStatus = { pending: 0, previewed: 0, sent: 0, failed: 0 };
    for (const row of rows) byStatus[text(row.status) as keyof typeof byStatus] = int(row.n);
    return { recipients: rows.reduce((sum, row) => sum + int(row.n), 0), byStatus };
  }

  function countPending(clubId: string): number {
    const row = db.prepare("SELECT COUNT(*) AS n FROM outbox_messages WHERE club_id = ? AND status IN ('pending', 'failed')").get(clubId) as Row;
    return int(row.n);
  }

  return { enqueue, list, preview, dispatch, countPending, countByReference };
}

export type OutboxModule = ReturnType<typeof createOutboxModule>;
