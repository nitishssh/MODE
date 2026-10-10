import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { transaction, type DbContext } from "./db/core";
import { SCHEMA_VERSION, migrate } from "./db/migrations";
import type { EventReport, Expense, LedgerEntry, LedgerSummary, PatchTaskInput, Receipt, TaskDetails } from "./contracts";
import { InvalidTransitionError } from "./workflow-errors";
import { DuplicateMemberError, NotFoundError } from "./errors";
import { createDashboardModule } from "./modules/dashboard";
import { createIdentityModule } from "./modules/identity";
import { ledgerBalance, listLedger, postLedgerEntry, reconcileLedger, type LedgerEntryInput } from "./modules/ledger";

export { DuplicateMemberError, NotFoundError };
export { InvalidTransitionError } from "./workflow-errors";
export { SCHEMA_VERSION };

/** Local store. This file must only be imported by server code. */
export function openClubDatabase(filename: string, options: { now?: () => Date; receiptsDir?: string } = {}) {
  const now = options.now ?? (() => new Date());
  const path = filename === ":memory:" ? filename : resolve(filename);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");

  try {
    migrate(db, now());
  } catch (error) {
    db.close();
    throw error;
  }

  const ctx: DbContext = { db, now, depth: 0 };
  const identity = createIdentityModule(ctx);
  const dashboard = createDashboardModule(ctx, identity);
  let closed = false;
  const receiptsDir = options.receiptsDir ?? resolve(dirname(path === ":memory:" ? ".data/mode.sqlite" : path), "receipts");

  const taskQuery = `SELECT t.*, m.name AS assignee_name, e.title AS event_title FROM tasks t LEFT JOIN members m ON m.id = t.assignee_id LEFT JOIN events e ON e.id = t.event_id`;
  const mapTask = (row: Record<string, unknown>): TaskDetails => {
    const dueAt = row.due_at === null ? null : String(row.due_at);
    return { id: String(row.id), title: String(row.title), description: row.description === null ? null : String(row.description), assignee: row.assignee_name === null ? null : String(row.assignee_name), assigneeId: row.assignee_id === null ? null : String(row.assignee_id), status: row.status as TaskDetails["status"], eventId: row.event_id === null ? null : String(row.event_id), eventTitle: row.event_title === null ? null : String(row.event_title), dueAt, overdue: dueAt !== null && row.status !== "done" && dueAt < now().toISOString(), createdAt: String(row.created_at) };
  };
  const getTaskById = (id: string): TaskDetails => {
    const row = db.prepare(`${taskQuery} WHERE t.id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundError("Task not found.");
    return mapTask(row);
  };
  const expenseQuery = `SELECT e.*, m.name AS submitter_name, ev.title AS event_title FROM expenses e JOIN members m ON m.id = e.submitter_id LEFT JOIN events ev ON ev.id = e.event_id`;
  const mapExpense = (row: Record<string, unknown>): Expense => ({ id: String(row.id), submitterId: String(row.submitter_id), submitterName: String(row.submitter_name), amountPaise: Number(row.amount_paise), purpose: String(row.purpose), receiptId: row.receipt_id === null ? null : String(row.receipt_id), receiptReference: row.receipt_reference === null ? null : String(row.receipt_reference), eventId: row.event_id === null ? null : String(row.event_id), eventTitle: row.event_title === null ? null : String(row.event_title), status: row.status as Expense["status"], rejectionNote: row.rejection_note === null ? null : String(row.rejection_note), paymentReference: row.payment_reference === null ? null : String(row.payment_reference), submittedAt: String(row.submitted_at), reviewedAt: row.reviewed_at === null ? null : String(row.reviewed_at), paidAt: row.paid_at === null ? null : String(row.paid_at) });
  const getExpense = (id: string): Expense => {
    const row = db.prepare(`${expenseQuery} WHERE e.id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundError("Expense not found.");
    return mapExpense(row);
  };

  return {
    ...identity,
    ...dashboard,
    ledger: {
      post: (input: LedgerEntryInput) => postLedgerEntry(ctx, input),
      list: () => listLedger(db),
      balance: () => ledgerBalance(db),
      reconcile: () => reconcileLedger(db),
    },
    getTasks: (filters: { status?: string; assigneeId?: string; eventId?: string; overdue?: boolean; mine?: boolean; currentUserId?: string } = {}): TaskDetails[] => {
      const conditions: string[] = []; const params: string[] = [];
      if (filters.status) { conditions.push("t.status = ?"); params.push(filters.status); }
      if (filters.assigneeId || (filters.mine && filters.currentUserId)) { conditions.push("t.assignee_id = ?"); params.push(filters.assigneeId ?? filters.currentUserId!); }
      if (filters.eventId) { conditions.push("t.event_id = ?"); params.push(filters.eventId); }
      if (filters.overdue) { conditions.push("t.due_at IS NOT NULL AND t.due_at < ? AND t.status != 'done'"); params.push(now().toISOString()); }
      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      return (db.prepare(`${taskQuery}${where} ORDER BY t.created_at DESC`).all(...params) as Record<string, unknown>[]).map(mapTask);
    },
    getTaskById,
    createTask: (input: { title: string; description?: string; assigneeId?: string; eventId?: string; dueAt?: string }): TaskDetails => {
      const id = randomUUID(); const createdAt = now().toISOString();
      const assignee = input.assigneeId ? (db.prepare("SELECT name FROM members WHERE id = ?").get(input.assigneeId) as { name?: string } | undefined)?.name ?? "Unassigned" : "Unassigned";
      db.prepare("INSERT INTO tasks (id, title, assignee, status, description, assignee_id, event_id, due_at, created_at) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?)").run(id, input.title.trim(), assignee, input.description?.trim() ?? null, input.assigneeId ?? null, input.eventId ?? null, input.dueAt ?? null, createdAt);
      return getTaskById(id);
    },
    patchTask: (id: string, input: PatchTaskInput): TaskDetails => {
      getTaskById(id); const sets: string[] = []; const params: (string | null)[] = [];
      if (input.title !== undefined) { sets.push("title = ?"); params.push(input.title.trim()); }
      if (input.description !== undefined) { sets.push("description = ?"); params.push(input.description?.trim() ?? null); }
      if ("assigneeId" in input) { const name = input.assigneeId ? (db.prepare("SELECT name FROM members WHERE id = ?").get(input.assigneeId) as { name?: string } | undefined)?.name ?? "Unassigned" : "Unassigned"; sets.push("assignee_id = ?", "assignee = ?"); params.push(input.assigneeId ?? null, name); }
      if ("eventId" in input) { sets.push("event_id = ?"); params.push(input.eventId ?? null); }
      if ("dueAt" in input) { sets.push("due_at = ?"); params.push(input.dueAt ?? null); }
      if (sets.length) db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
      return getTaskById(id);
    },
    updateTaskStatus: (id: string, status: TaskDetails["status"]): TaskDetails => { getTaskById(id); db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id); return getTaskById(id); },
    saveReceipt: (input: { uploaderId: string; uploaderName: string; filename: string; mimeType: string; sizeBytes: number; data: Buffer }): Receipt => {
      const id = randomUUID(); const uploadedAt = now().toISOString(); if (path !== ":memory:") { mkdirSync(receiptsDir, { recursive: true }); writeFileSync(join(/* turbopackIgnore: true */ receiptsDir, id), input.data); }
      db.prepare("INSERT INTO receipts (id, uploader_id, uploader_name, filename, mime_type, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, input.uploaderId, input.uploaderName, input.filename, input.mimeType, input.sizeBytes, uploadedAt);
      return { id, uploaderId: input.uploaderId, uploaderName: input.uploaderName, filename: input.filename, mimeType: input.mimeType, sizeBytes: input.sizeBytes, uploadedAt };
    },
    getReceiptById: (id: string): Receipt => { const row = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as Record<string, unknown> | undefined; if (!row) throw new NotFoundError("Receipt not found."); return { id: String(row.id), uploaderId: String(row.uploader_id), uploaderName: String(row.uploader_name), filename: String(row.filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), uploadedAt: String(row.uploaded_at) }; },
    getReceiptFile: (id: string): Buffer | null => path === ":memory:" || !existsSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ receiptsDir, id)) ? null : readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ receiptsDir, id)),
    getExpenses: (filters: { submitterId?: string } = {}): Expense[] => (db.prepare(`${expenseQuery}${filters.submitterId ? " WHERE e.submitter_id = ?" : ""} ORDER BY e.submitted_at DESC`).all(...(filters.submitterId ? [filters.submitterId] : [])) as Record<string, unknown>[]).map(mapExpense),
    submitExpense: (input: { submitterId: string; amountPaise: number; purpose: string; receiptId?: string; receiptReference?: string; eventId?: string }): Expense => { const id = randomUUID(); db.prepare("INSERT INTO expenses (id, submitter_id, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?)").run(id, input.submitterId, input.amountPaise, input.purpose.trim(), input.receiptId ?? null, input.receiptReference ?? null, input.eventId ?? null, now().toISOString()); return getExpense(id); },
    approveExpense: (id: string, reviewerId: string): Expense => { const expense = getExpense(id); if (expense.status !== "submitted") throw new InvalidTransitionError("Only submitted expenses can be approved."); if (expense.submitterId === reviewerId) throw new InvalidTransitionError("You cannot approve your own expense."); db.prepare("UPDATE expenses SET status = 'approved', reviewed_at = ? WHERE id = ?").run(now().toISOString(), id); return getExpense(id); },
    rejectExpense: (id: string, reviewerId: string, note?: string): Expense => { const expense = getExpense(id); if (expense.status !== "submitted") throw new InvalidTransitionError("Only submitted expenses can be rejected."); if (expense.submitterId === reviewerId) throw new InvalidTransitionError("You cannot reject your own expense."); db.prepare("UPDATE expenses SET status = 'rejected', reviewed_at = ?, rejection_note = ? WHERE id = ?").run(now().toISOString(), note ?? null, id); return getExpense(id); },
    payExpense: (id: string, paymentReference: string): Expense => transaction(ctx, () => { const expense = getExpense(id); if (expense.status !== "approved") throw new InvalidTransitionError("Only approved expenses can be paid."); db.prepare("UPDATE expenses SET status = 'paid', paid_at = ?, payment_reference = ? WHERE id = ?").run(now().toISOString(), paymentReference, id); postLedgerEntry(ctx, { kind: "expense", amountPaise: expense.amountPaise, description: expense.purpose, source: { type: "expense", id }, recordedBy: null }); return getExpense(id); }),
    getLedgerEntries: (): LedgerEntry[] => (db.prepare("SELECT t.*, e.title AS event_title FROM transactions t LEFT JOIN expenses x ON t.source_type = 'expense' AND t.source_id = x.id LEFT JOIN events e ON e.id = x.event_id ORDER BY t.occurred_at DESC, t.rowid DESC").all() as Record<string, unknown>[]).map((row) => ({ id: String(row.id), description: String(row.description), kind: row.kind as LedgerEntry["kind"], amountPaise: Number(row.amount_paise), occurredAt: String(row.occurred_at), sourceType: row.source_type === null ? null : String(row.source_type), sourceId: row.source_id === null ? null : String(row.source_id), recordedBy: row.recorded_by === null ? null : String(row.recorded_by), type: row.kind === "income" ? "income" : "expense_paid", category: row.source_type === "expense" ? "expense" : "general", eventId: null, eventTitle: row.event_title === null ? null : String(row.event_title), reference: null })),
    getLedgerSummary: (): LedgerSummary => { const entries = (db.prepare("SELECT kind, amount_paise FROM transactions").all() as Record<string, unknown>[]); const inflowPaise = entries.filter((row) => row.kind === "income").reduce((sum, row) => sum + Number(row.amount_paise), 0); const outflowPaise = entries.filter((row) => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount_paise), 0); const approvedUnpaidPaise = Number((db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expenses WHERE status = 'approved'").get() as { total: number }).total); return { inflowPaise, outflowPaise, balancePaise: inflowPaise - outflowPaise, approvedUnpaidPaise, byCategory: [], byEvent: [] }; },
    getEventReport: (eventId: string): EventReport => { const event = db.prepare("SELECT title, fundraiser_goal_paise FROM events WHERE id = ?").get(eventId) as { title?: string; fundraiser_goal_paise?: number } | undefined; if (!event) throw new NotFoundError("Event not found."); const tasks = (db.prepare("SELECT status, due_at FROM tasks WHERE event_id = ?").all(eventId) as Array<{ status: string; due_at: string | null }>); const raisedPaise = Number((db.prepare("SELECT COALESCE(SUM(t.amount_paise), 0) AS total FROM transactions t JOIN expenses x ON t.source_type = 'expense' AND t.source_id = x.id WHERE x.event_id = ? AND t.kind = 'income'").get(eventId) as { total: number }).total); const goalPaise = event.fundraiser_goal_paise ?? 0; return { eventId, eventTitle: event.title ?? "Event", fundraiser: { goalPaise, raisedPaise, remainingPaise: Math.max(0, goalPaise - raisedPaise), percent: goalPaise ? Math.min(100, Math.round((raisedPaise / goalPaise) * 100)) : 0, onTrack: goalPaise === 0 || raisedPaise >= goalPaise / 2 }, tasks: { total: tasks.length, todo: tasks.filter((task) => task.status === "todo").length, inProgress: tasks.filter((task) => task.status === "in_progress").length, done: tasks.filter((task) => task.status === "done").length, overdue: tasks.filter((task) => task.status !== "done" && task.due_at !== null && task.due_at < now().toISOString()).length } }; },
    /** Run `fn` atomically; financial modules post their ledger row inside it. */
    transaction: <T>(fn: () => T): T => transaction(ctx, fn),
    health: () => {
      db.prepare("SELECT 1").get();
      return { status: "ok" as const, database: "sqlite" as const, schemaVersion: SCHEMA_VERSION };
    },
    close: () => {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}

export type ClubDatabase = ReturnType<typeof openClubDatabase>;

/** Wall clock, or a frozen demo clock when MODE_DEMO_NOW holds an ISO timestamp. */
function applicationClock(): Date {
  const frozen = process.env.MODE_DEMO_NOW;
  if (frozen) {
    const parsed = new Date(frozen);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

// Reuse one connection across route calls and Next.js development reloads.
const globalStore = globalThis as typeof globalThis & { modeDatabase?: ClubDatabase; modeDatabasePath?: string };

export function getDatabase(): ClubDatabase {
  const path = process.env.SQLITE_PATH || ".data/mode.sqlite";
  if (!globalStore.modeDatabase || globalStore.modeDatabasePath !== path) {
    globalStore.modeDatabase?.close();
    globalStore.modeDatabase = openClubDatabase(path, { now: applicationClock });
    globalStore.modeDatabasePath = path;
  }
  return globalStore.modeDatabase;
}
