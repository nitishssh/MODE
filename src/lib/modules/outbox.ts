import { randomUUID } from "node:crypto";
import type { OutboxMessage } from "../contracts";
import { SQLITE_CONSTRAINT_UNIQUE, int, isConstraintError, nullableText, text, type DbContext, type Row } from "../db/core";
import { DomainError } from "../errors";
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
}

/** Local demos only have the preview transport. Real email is configured, never faked. */
export function mailTransport(): "preview" | "smtp" {
  return process.env.MODE_MAIL_TRANSPORT === "smtp" ? "smtp" : "preview";
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
        `INSERT INTO outbox_messages (id, club_id, kind, recipient_member_id, recipient_email, subject, body, dedupe_key, status, attempts, last_error, created_at, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, NULL)`,
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
   * Attempt delivery for queued messages. With the preview transport each message
   * becomes `previewed`, never `sent`; a real transport must be configured to mark `sent`.
   */
  function dispatch(actor: Actor, options: { limit?: number; maxAttempts?: number } = {}) {
    assertPermission(actor, "outbox:manage");
    const limit = options.limit ?? 100;
    const maxAttempts = options.maxAttempts ?? 5;
    const transport = mailTransport();
    if (transport !== "preview") {
      throw new DomainError("No real mail transport is configured for this deployment.", 501, "mail_transport_unavailable");
    }
    const due = db
      .prepare(
        "SELECT id FROM outbox_messages WHERE club_id = ? AND status IN ('pending', 'failed') AND attempts < ? ORDER BY created_at, id LIMIT ?",
      )
      .all(actor.clubId, maxAttempts, limit) as Row[];
    const update = db.prepare(
      "UPDATE outbox_messages SET status = 'previewed', attempts = attempts + 1, last_error = NULL, delivered_at = ? WHERE id = ? AND status IN ('pending', 'failed')",
    );
    let previewed = 0;
    for (const row of due) {
      const result = update.run(ctx.now().toISOString(), text(row.id));
      previewed += Number(result.changes);
    }
    return { transport, previewed, remaining: countPending(actor.clubId) };
  }

  function countPending(clubId: string): number {
    const row = db.prepare("SELECT COUNT(*) AS n FROM outbox_messages WHERE club_id = ? AND status IN ('pending', 'failed')").get(clubId) as Row;
    return int(row.n);
  }

  return { enqueue, list, preview, dispatch, countPending };
}

export type OutboxModule = ReturnType<typeof createOutboxModule>;
