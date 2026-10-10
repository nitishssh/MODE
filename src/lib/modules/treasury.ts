import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import type { ExpenseRequest, LedgerEntry, LedgerSummary, Receipt } from "../contracts";
import { hasPermission } from "../auth/permissions";
import { SQLITE_CONSTRAINT_UNIQUE, int, isConstraintError, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { LedgerModule } from "./ledger";
import { parseInput } from "../validation";

export const RECEIPT_MAX_BYTES = 2 * 1024 * 1024;
export const RECEIPT_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const expenseInputSchema = z
  .object({
    amountPaise: z.number().int().positive("Amount must be a positive number of paise."),
    purpose: z.string().trim().min(3).max(500),
    receiptId: z.string().min(1).optional(),
    receiptReference: z.string().trim().min(3).max(200).optional(),
    eventId: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => value.receiptId || value.receiptReference, { message: "Attach a receipt or give a receipt reference.", path: ["receiptId"] });

export const decisionSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();
export const payoutSchema = z.object({ paymentReference: z.string().trim().min(3).max(120) }).strict();

function mapEntry(row: Row): LedgerEntry {
  return {
    id: text(row.id),
    description: text(row.description),
    kind: row.kind as LedgerEntry["kind"],
    amountPaise: int(row.amount_paise),
    occurredAt: text(row.occurred_at),
    category: row.category as LedgerEntry["category"],
    sourceType: nullableText(row.source_type),
    sourceId: nullableText(row.source_id),
    eventId: nullableText(row.event_id),
    memberId: nullableText(row.member_id),
  };
}

function mapExpense(row: Row): ExpenseRequest {
  return {
    id: text(row.id),
    requestedBy: text(row.requested_by),
    requesterName: text(row.requester_name),
    amountPaise: int(row.amount_paise),
    purpose: text(row.purpose),
    receiptId: nullableText(row.receipt_id),
    receiptReference: nullableText(row.receipt_reference),
    eventId: nullableText(row.event_id),
    status: row.status as ExpenseRequest["status"],
    reviewedBy: nullableText(row.reviewed_by),
    reviewedAt: nullableText(row.reviewed_at),
    decisionNote: nullableText(row.decision_note),
    paidBy: nullableText(row.paid_by),
    paidAt: nullableText(row.paid_at),
    paymentReference: nullableText(row.payment_reference),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function mapReceipt(row: Row): Receipt {
  return {
    id: text(row.id),
    uploadedBy: text(row.uploaded_by),
    originalName: text(row.original_name),
    mimeType: text(row.mime_type),
    sizeBytes: int(row.size_bytes),
    sha256: text(row.sha256),
    createdAt: text(row.created_at),
  };
}

const EXPENSE_SELECT = "SELECT e.*, m.name AS requester_name FROM expense_requests e JOIN members m ON m.id = e.requested_by";

export interface TreasuryOptions {
  /** Directory for uploaded receipts; defaults next to the database and must never be web-served. */
  receiptDirectory: string;
}

export function createTreasuryModule(ctx: DbContext, identity: IdentityModule, ledger: LedgerModule, options: TreasuryOptions) {
  const { db } = ctx;

  // ---- Ledger reads -------------------------------------------------------
  function listEntries(actor: Actor, filter: { category?: LedgerEntry["category"]; eventId?: string } = {}): LedgerEntry[] {
    assertPermission(actor, "ledger:read");
    const clauses = ["club_id = ?"];
    const params: string[] = [actor.clubId];
    if (filter.category) {
      clauses.push("category = ?");
      params.push(filter.category);
    }
    if (filter.eventId) {
      clauses.push("event_id = ?");
      params.push(filter.eventId);
    }
    return (db.prepare(`SELECT * FROM transactions WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC, id`).all(...params) as Row[]).map(mapEntry);
  }

  function summary(actor: Actor): LedgerSummary {
    assertPermission(actor, "ledger:read");
    const totals = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE 0 END), 0) AS inflow,
                COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_paise ELSE 0 END), 0) AS outflow
         FROM transactions WHERE club_id = ?`,
      )
      .get(actor.clubId) as Row;
    const byCategory = (
      db
        .prepare(
          `SELECT category,
                  COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE 0 END), 0) AS inflow,
                  COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_paise ELSE 0 END), 0) AS outflow
           FROM transactions WHERE club_id = ? GROUP BY category ORDER BY category`,
        )
        .all(actor.clubId) as Row[]
    ).map((row) => ({ category: row.category as LedgerEntry["category"], inflowPaise: int(row.inflow), outflowPaise: int(row.outflow) }));
    const byEvent = (
      db
        .prepare(
          `SELECT t.event_id, ev.title,
                  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount_paise ELSE 0 END), 0) AS inflow,
                  COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount_paise ELSE 0 END), 0) AS outflow
           FROM transactions t JOIN events ev ON ev.id = t.event_id
           WHERE t.club_id = ? AND t.event_id IS NOT NULL GROUP BY t.event_id, ev.title ORDER BY ev.starts_at, ev.title`,
        )
        .all(actor.clubId) as Row[]
    ).map((row) => ({
      eventId: text(row.event_id),
      title: text(row.title),
      inflowPaise: int(row.inflow),
      outflowPaise: int(row.outflow),
      netPaise: int(row.inflow) - int(row.outflow),
    }));
    const approvedUnpaid = db
      .prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expense_requests WHERE club_id = ? AND status = 'approved'")
      .get(actor.clubId) as Row;
    return {
      inflowPaise: int(totals.inflow),
      outflowPaise: int(totals.outflow),
      balancePaise: int(totals.inflow) - int(totals.outflow),
      approvedUnpaidPaise: int(approvedUnpaid.total),
      byCategory,
      byEvent,
    };
  }

  function exportCsv(actor: Actor): string {
    const entries = listEntries(actor);
    const escape = (value: string | null) => `"${(value ?? "").replace(/"/g, '""')}"`;
    const lines = ["id,occurredAt,kind,category,amountPaise,description,sourceType,sourceId,eventId,memberId"];
    for (const entry of entries) {
      lines.push(
        [entry.id, entry.occurredAt, entry.kind, entry.category, String(entry.amountPaise), escape(entry.description), entry.sourceType ?? "", entry.sourceId ?? "", entry.eventId ?? "", entry.memberId ?? ""].join(","),
      );
    }
    return `${lines.join("\n")}\n`;
  }

  // ---- Receipts -----------------------------------------------------------
  /** Store an uploaded receipt privately. Enforces size and type before anything touches disk. */
  function storeReceipt(actor: Actor, file: { name: string; type: string; bytes: Uint8Array }): Receipt {
    assertPermission(actor, "expenses:submit");
    const extension = RECEIPT_MIME_TYPES[file.type];
    if (!extension) throw new DomainError("Receipts must be JPEG, PNG, WebP or PDF.", 415, "unsupported_receipt_type");
    if (file.bytes.byteLength === 0) throw new ValidationError("The receipt file is empty.");
    if (file.bytes.byteLength > RECEIPT_MAX_BYTES) throw new DomainError(`Receipts must be at most ${RECEIPT_MAX_BYTES / (1024 * 1024)} MB.`, 413, "receipt_too_large");
    const id = randomUUID();
    const sha256 = createHash("sha256").update(file.bytes).digest("hex");
    const storagePath = join(options.receiptDirectory, actor.clubId, `${id}.${extension}`);
    mkdirSync(dirname(storagePath), { recursive: true });
    writeFileSync(storagePath, file.bytes, { flag: "wx" });
    const originalName = file.name.replace(/[\r\n"\\/]/g, "_").slice(0, 200) || `receipt.${extension}`;
    db.prepare("INSERT INTO receipts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id,
      actor.clubId,
      actor.memberId,
      originalName,
      file.type,
      file.bytes.byteLength,
      sha256,
      resolve(storagePath),
      ctx.now().toISOString(),
    );
    identity.recordAudit(actor, "receipt.uploaded", "receipt", id, { sizeBytes: file.bytes.byteLength, mimeType: file.type });
    return mapReceipt(db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as Row);
  }

  /** Only the uploader and reviewers may read a receipt; the path never leaves the server. */
  function readReceipt(actor: Actor, receiptId: string): { receipt: Receipt; bytes: Buffer } {
    const row = db.prepare("SELECT * FROM receipts WHERE club_id = ? AND id = ?").get(actor.clubId, receiptId) as Row | undefined;
    if (!row) throw new NotFoundError("Receipt not found.");
    if (text(row.uploaded_by) !== actor.memberId && !hasPermission(actor.role, "expenses:review")) throw new ForbiddenError();
    return { receipt: mapReceipt(row), bytes: readFileSync(text(row.storage_path)) };
  }

  // ---- Reimbursement workflow ---------------------------------------------
  function requireExpense(clubId: string, id: string): ExpenseRequest {
    const row = db.prepare(`${EXPENSE_SELECT} WHERE e.club_id = ? AND e.id = ?`).get(clubId, id) as Row | undefined;
    if (!row) throw new NotFoundError("Expense request not found.");
    return mapExpense(row);
  }

  function submitExpense(actor: Actor, input: z.infer<typeof expenseInputSchema>): ExpenseRequest {
    assertPermission(actor, "expenses:submit");
    const data = parseInput(expenseInputSchema, input);
    return transaction(ctx, () => {
      if (data.receiptId) {
        const receipt = db.prepare("SELECT uploaded_by FROM receipts WHERE club_id = ? AND id = ?").get(actor.clubId, data.receiptId) as Row | undefined;
        if (!receipt) throw new NotFoundError("Receipt not found.");
        if (text(receipt.uploaded_by) !== actor.memberId) throw new ForbiddenError("You can only attach receipts you uploaded.");
      }
      if (data.eventId && !db.prepare("SELECT 1 FROM events WHERE club_id = ? AND id = ?").get(actor.clubId, data.eventId)) {
        throw new NotFoundError("Event not found.");
      }
      const id = randomUUID();
      const nowIso = ctx.now().toISOString();
      try {
        db.prepare(
          `INSERT INTO expense_requests (id, club_id, requested_by, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
        ).run(id, actor.clubId, actor.memberId, data.amountPaise, data.purpose, data.receiptId ?? null, data.receiptReference ?? null, data.eventId ?? null, nowIso, nowIso);
      } catch (error) {
        if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new ConflictError("This receipt is already attached to another expense request.", "duplicate_receipt");
        throw error;
      }
      identity.recordAudit(actor, "expense.submitted", "expense_request", id, { amountPaise: data.amountPaise, eventId: data.eventId ?? null });
      return requireExpense(actor.clubId, id);
    });
  }

  function listExpenses(actor: Actor, filter: { status?: ExpenseRequest["status"] } = {}): ExpenseRequest[] {
    const reviewer = hasPermission(actor.role, "expenses:review");
    const clauses = ["e.club_id = ?"];
    const params: string[] = [actor.clubId];
    if (!reviewer) {
      clauses.push("e.requested_by = ?");
      params.push(actor.memberId);
    }
    if (filter.status) {
      clauses.push("e.status = ?");
      params.push(filter.status);
    }
    return (db.prepare(`${EXPENSE_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY e.created_at DESC`).all(...params) as Row[]).map(mapExpense);
  }

  function decide(actor: Actor, id: string, decision: "approved" | "rejected", note?: string): ExpenseRequest {
    assertPermission(actor, "expenses:review");
    parseInput(decisionSchema, { note });
    return transaction(ctx, () => {
      const expense = requireExpense(actor.clubId, id);
      if (expense.requestedBy === actor.memberId) throw new ForbiddenError("You cannot review your own expense request.");
      if (expense.status !== "submitted") throw new ConflictError(`This request is already ${expense.status}.`, "expense_not_pending");
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE expense_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, decision_note = ?, updated_at = ? WHERE id = ?").run(decision, actor.memberId, nowIso, note ?? null, nowIso, id);
      identity.recordAudit(actor, `expense.${decision}`, "expense_request", id, { note: note ?? null, amountPaise: expense.amountPaise });
      return requireExpense(actor.clubId, id);
    });
  }

  /** Only this step moves cash: the ledger expense row is written exactly once here. */
  function markPaid(actor: Actor, id: string, paymentReference: string): { expense: ExpenseRequest; created: boolean } {
    assertPermission(actor, "expenses:review");
    parseInput(payoutSchema, { paymentReference });
    return transaction(ctx, () => {
      const expense = requireExpense(actor.clubId, id);
      if (expense.status === "paid") {
        if (expense.paymentReference === paymentReference) return { expense, created: false };
        throw new ConflictError("This reimbursement was already paid with a different reference.", "already_paid");
      }
      if (expense.status !== "approved") throw new ConflictError(`Only approved requests can be paid; this one is ${expense.status}.`, "expense_not_approved");
      const nowIso = ctx.now().toISOString();
      try {
        db.prepare("UPDATE expense_requests SET status = 'paid', paid_by = ?, paid_at = ?, payment_reference = ?, updated_at = ? WHERE id = ?").run(actor.memberId, nowIso, paymentReference, nowIso, id);
      } catch (error) {
        if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new ConflictError("This payment reference was already used for another reimbursement.", "payment_reference_reused");
        throw error;
      }
      ledger.postEntry({
        clubId: actor.clubId,
        kind: "expense",
        category: "reimbursement",
        amountPaise: expense.amountPaise,
        description: `Reimbursement · ${expense.purpose} · ${expense.requesterName}`,
        source: { type: "expense_request", id },
        eventId: expense.eventId,
        memberId: expense.requestedBy,
      });
      identity.recordAudit(actor, "expense.paid", "expense_request", id, { paymentReference, amountPaise: expense.amountPaise });
      return { expense: requireExpense(actor.clubId, id), created: true };
    });
  }

  return { listEntries, summary, exportCsv, storeReceipt, readReceipt, submitExpense, listExpenses, requireExpense, decide, markPaid };
}

export type TreasuryModule = ReturnType<typeof createTreasuryModule>;
