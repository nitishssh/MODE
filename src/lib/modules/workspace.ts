import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Expense, ExpenseStatus, ExpenseLedgerEntry, LedgerSummary, Receipt, TaskDetails, CreateTaskInput, PatchTaskInput, SubmitExpenseInput } from "../contracts";
import { transaction, type DbContext, type Row } from "../db/core";
import { hasPermission } from "../auth/permissions";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors";
import { postLedgerEntry } from "./ledger";

function mapTaskDetails(row: Row, now: string): TaskDetails {
  const dueAt = row.due_at !== null ? String(row.due_at) : null;
  const overdue = dueAt !== null && row.status !== "done" && dueAt < now;
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description !== null ? String(row.description) : null,
    assignee: row.assignee_name !== null ? String(row.assignee_name) : null,
    assigneeId: row.assignee_id !== null ? String(row.assignee_id) : null,
    status: row.status as TaskDetails["status"],
    eventId: row.event_id !== null ? String(row.event_id) : null,
    eventTitle: row.event_title !== null ? String(row.event_title) : null,
    dueAt,
    overdue,
    createdAt: String(row.created_at),
  };
}

function mapExpense(row: Row): Expense {
  return {
    id: String(row.id),
    submitterId: String(row.submitter_id),
    submitterName: String(row.submitter_name),
    amountPaise: Number(row.amount_paise),
    purpose: String(row.purpose),
    receiptId: row.receipt_id !== null ? String(row.receipt_id) : null,
    receiptReference: row.receipt_reference !== null ? String(row.receipt_reference) : null,
    eventId: row.event_id !== null ? String(row.event_id) : null,
    eventTitle: row.event_title !== null ? String(row.event_title) : null,
    status: row.status as ExpenseStatus,
    rejectionNote: row.rejection_note !== null ? String(row.rejection_note) : null,
    paymentReference: row.payment_reference !== null ? String(row.payment_reference) : null,
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at !== null ? String(row.reviewed_at) : null,
    paidAt: row.paid_at !== null ? String(row.paid_at) : null,
  };
}


export function createWorkspaceModule(ctx: DbContext, identity: IdentityModule, receiptsDir: string) {
  const { db, now } = ctx;
  function requireEvent(actor: Actor, id?: string | null) {
    if (id && !db.prepare("SELECT 1 FROM events WHERE id = ? AND club_id = ?").get(id, actor.clubId)) throw new NotFoundError("Event not found.");
  }
  function assignee(actor: Actor, id?: string | null) {
    return id ? identity.requireMember(actor.clubId, id).name : "Unassigned";
  }
  const taskQuery = `SELECT t.*, m.name AS assignee_name, e.title AS event_title FROM tasks t
    LEFT JOIN members m ON m.id = t.assignee_id LEFT JOIN events e ON e.id = t.event_id`;
  function getTaskById(actor: Actor, id: string): TaskDetails {
    const row = db.prepare(taskQuery + " WHERE t.id = ? AND t.club_id = ?").get(id, actor.clubId);
    if (!row) throw new NotFoundError("Task not found.");
    return mapTaskDetails(row, now().toISOString());
  }
  function getTasks(actor: Actor, filters: {status?: string; assigneeId?: string; eventId?: string; overdue?: boolean; mine?: boolean} = {}) {
    const clauses = ["t.club_id = ?"];
    const values: string[] = [actor.clubId];
    for (const [column, value] of [["t.status", filters.status], ["t.assignee_id", filters.mine ? actor.memberId : filters.assigneeId], ["t.event_id", filters.eventId]]) {
      if (value) { clauses.push(column + " = ?"); values.push(value); }
    }
    if (filters.overdue) { clauses.push("t.due_at < ? AND t.status != 'done'"); values.push(now().toISOString()); }
    return db.prepare(taskQuery + " WHERE " + clauses.join(" AND ") + " ORDER BY t.created_at DESC, t.id").all(...values).map(row => mapTaskDetails(row, now().toISOString()));
  }
  function createTask(actor: Actor, input: CreateTaskInput) {
    assertPermission(actor, "tasks:write");
    return transaction(ctx, () => {
      requireEvent(actor, input.eventId);
      const name = assignee(actor, input.assigneeId);
      const id = randomUUID();
      db.prepare("INSERT INTO tasks (id, club_id, title, assignee, description, assignee_id, event_id, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', ?)")
        .run(id, actor.clubId, input.title.trim(), name, input.description?.trim() ?? null, input.assigneeId ?? null, input.eventId ?? null, input.dueAt ? new Date(input.dueAt).toISOString() : null, now().toISOString());
      identity.recordAudit(actor, "task.created", "task", id);
      return getTaskById(actor, id);
    });
  }
  function patchTask(actor: Actor, id: string, input: PatchTaskInput) {
    assertPermission(actor, "tasks:write");
    return transaction(ctx, () => {
      getTaskById(actor, id);
      requireEvent(actor, input.eventId);
      const sets: string[] = [], values: (string | null)[] = [];
      if (input.title !== undefined) { sets.push("title = ?"); values.push(input.title.trim()); }
      if (input.description !== undefined) { sets.push("description = ?"); values.push(input.description?.trim() ?? null); }
      if (input.assigneeId !== undefined) { sets.push("assignee_id = ?", "assignee = ?"); values.push(input.assigneeId, assignee(actor, input.assigneeId)); }
      if (input.eventId !== undefined) { sets.push("event_id = ?"); values.push(input.eventId); }
      if (input.dueAt !== undefined) { sets.push("due_at = ?"); values.push(input.dueAt ? new Date(input.dueAt).toISOString() : null); }
      if (sets.length) db.prepare("UPDATE tasks SET " + sets.join(", ") + " WHERE id = ? AND club_id = ?").run(...values, id, actor.clubId);
      identity.recordAudit(actor, "task.updated", "task", id);
      return getTaskById(actor, id);
    });
  }
  function updateTaskStatus(actor: Actor, id: string, status: TaskDetails["status"]) {
    return transaction(ctx, () => {
      const task = getTaskById(actor, id);
      if (!hasPermission(actor.role, "tasks:write") && task.assigneeId !== actor.memberId && actor.role !== "volunteer") throw new ForbiddenError();
      db.prepare("UPDATE tasks SET status = ? WHERE id = ? AND club_id = ?").run(status, id, actor.clubId);
      identity.recordAudit(actor, "task.status_updated", "task", id, { status });
      return getTaskById(actor, id);
    });
  }
  function getReceiptById(actor: Actor, id: string): Receipt {
    const row = db.prepare("SELECT r.*, m.name AS uploader_name FROM receipts r JOIN members m ON m.id = r.uploader_id WHERE r.id = ? AND r.club_id = ?").get(id, actor.clubId);
    if (!row) throw new NotFoundError("Receipt not found.");
    if (row.uploader_id !== actor.memberId && !hasPermission(actor.role, "expenses:review")) throw new ForbiddenError();
    return {id: String(row.id), uploaderId: String(row.uploader_id), uploaderName: String(row.uploader_name), filename: String(row.filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), uploadedAt: String(row.uploaded_at)};
  }
  function saveReceipt(actor: Actor, input: {filename: string; mimeType: string; sizeBytes: number; data: Buffer}) {
    assertPermission(actor, "expenses:submit");
    const id = randomUUID();
    mkdirSync(receiptsDir, { recursive: true });
    writeFileSync(join(receiptsDir, id), input.data, { flag: "wx" });
    try {
      return transaction(ctx, () => {
        db.prepare("INSERT INTO receipts (id, club_id, uploader_id, filename, mime_type, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(id, actor.clubId, actor.memberId, input.filename, input.mimeType, input.sizeBytes, now().toISOString());
        return getReceiptById(actor, id);
      });
    } catch (error) { unlinkSync(join(receiptsDir, id)); throw error; }
  }
  function getReceiptFile(actor: Actor, id: string) {
    getReceiptById(actor, id);
    try { return readFileSync(join(receiptsDir, id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  const expenseQuery = `SELECT e.*, m.name AS submitter_name, ev.title AS event_title FROM expenses e JOIN members m ON m.id = e.submitter_id LEFT JOIN events ev ON ev.id = e.event_id`;
  function getExpenseById(actor: Actor, id: string) {
    const row = db.prepare(expenseQuery + " WHERE e.id = ? AND e.club_id = ?").get(id, actor.clubId);
    if (!row) throw new NotFoundError("Expense not found.");
    if (row.submitter_id !== actor.memberId && !hasPermission(actor.role, "expenses:review")) throw new ForbiddenError();
    return mapExpense(row);
  }
  function getExpenses(actor: Actor, filters: {submitterId?: string} = {}) {
    const owner = hasPermission(actor.role, "expenses:review") ? filters.submitterId : actor.memberId;
    return db.prepare(expenseQuery + " WHERE e.club_id = ?" + (owner ? " AND e.submitter_id = ?" : "") + " ORDER BY e.submitted_at DESC, e.id")
      .all(...(owner ? [actor.clubId, owner] : [actor.clubId])).map(mapExpense);
  }
  function submitExpense(actor: Actor, input: SubmitExpenseInput) {
    assertPermission(actor, "expenses:submit");
    return transaction(ctx, () => {
      requireEvent(actor, input.eventId);
      if (input.receiptId && getReceiptById(actor, input.receiptId).uploaderId !== actor.memberId) throw new ForbiddenError("Use your own receipt.");
      const id = randomUUID();
      db.prepare("INSERT INTO expenses (id, club_id, submitter_id, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)")
        .run(id, actor.clubId, actor.memberId, input.amountPaise, input.purpose.trim(), input.receiptId ?? null, input.receiptReference ?? null, input.eventId ?? null, now().toISOString());
      identity.recordAudit(actor, "expense.submitted", "expense", id);
      return getExpenseById(actor, id);
    });
  }
  function reviewExpense(actor: Actor, id: string, status: "approved" | "rejected", note?: string) {
    assertPermission(actor, "expenses:review");
    return transaction(ctx, () => {
      const expense = getExpenseById(actor, id);
      if (expense.submitterId === actor.memberId) throw new ForbiddenError("You cannot review your own expense.");
      if (expense.status !== "submitted") throw new ConflictError("Only submitted expenses can be reviewed.");
      db.prepare("UPDATE expenses SET status = ?, reviewer_id = ?, reviewed_at = ?, rejection_note = ? WHERE id = ? AND club_id = ?")
        .run(status, actor.memberId, now().toISOString(), note ?? null, id, actor.clubId);
      identity.recordAudit(actor, "expense." + status, "expense", id);
      return getExpenseById(actor, id);
    });
  }
  function payExpense(actor: Actor, id: string, paymentReference: string) {
    assertPermission(actor, "expenses:review");
    return transaction(ctx, () => {
      const expense = getExpenseById(actor, id);
      if (expense.submitterId === actor.memberId) throw new ForbiddenError("You cannot pay your own expense.");
      if (expense.status === "paid" && expense.paymentReference === paymentReference) return expense;
      if (expense.status !== "approved") throw new ConflictError("Only approved expenses can be paid.");
      db.prepare("UPDATE expenses SET status = 'paid', paid_at = ?, payment_reference = ? WHERE id = ? AND club_id = ?")
        .run(now().toISOString(), paymentReference, id, actor.clubId);
      postLedgerEntry(ctx, {kind: "expense", amountPaise: expense.amountPaise, description: expense.purpose, source: {type: "expense", id}, recordedBy: actor.memberId, clubId: actor.clubId, eventId: expense.eventId});
      identity.recordAudit(actor, "expense.paid", "expense", id, {paymentReference});
      return getExpenseById(actor, id);
    });
  }
  function ledgerRows(actor: Actor): ExpenseLedgerEntry[] {
    return db.prepare(`SELECT l.*, e.title AS event_title,
      COALESCE(x.payment_reference, tk.payment_reference, dp.reference, mo.payment_reference) AS payment_reference
      FROM transactions l LEFT JOIN events e ON e.id = l.event_id
      LEFT JOIN expenses x ON l.source_type = 'expense' AND x.id = l.source_id
      LEFT JOIN tickets tk ON l.source_type = 'ticket' AND tk.id = l.source_id
      LEFT JOIN dues_payments dp ON l.source_type = 'dues_payment' AND dp.id = l.source_id
      LEFT JOIN merch_orders mo ON l.source_type = 'merch_order' AND mo.id = l.source_id
      WHERE l.club_id = ? ORDER BY l.occurred_at DESC, l.rowid DESC`)
      .all(actor.clubId).map(row => ({id: String(row.id), type: row.kind === "income" ? "income" : "expense_paid", description: String(row.description), amountPaise: Number(row.amount_paise), category: row.source_type === "dues_payment" ? "membership" : row.source_type === "ticket" ? "events" : String(row.source_type), eventId: row.event_id === null ? null : String(row.event_id), eventTitle: row.event_title === null ? null : String(row.event_title), reference: row.payment_reference === null ? null : String(row.payment_reference), occurredAt: String(row.occurred_at)}));
  }
  function getLedgerEntries(actor: Actor) { assertPermission(actor, "ledger:read"); return ledgerRows(actor); }
  function getLedgerSummary(actor: Actor): LedgerSummary {
    const entries = getLedgerEntries(actor);
    const totals = (rows: ExpenseLedgerEntry[]) => ({inflowPaise: rows.filter(r => r.type === "income").reduce((sum,r) => sum+r.amountPaise,0), outflowPaise: rows.filter(r => r.type === "expense_paid").reduce((sum,r) => sum+r.amountPaise,0)});
    const total = totals(entries);
    return {...total, balancePaise: total.inflowPaise-total.outflowPaise,
      approvedUnpaidPaise: Number(db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expenses WHERE club_id = ? AND status = 'approved'").get(actor.clubId)?.total ?? 0),
      byCategory: [...new Set(entries.map(r => r.category))].filter((c): c is string => c !== null).map(category => ({category, ...totals(entries.filter(r => r.category === category))})),
      byEvent: [...new Set(entries.map(r => r.eventId))].filter((e): e is string => e !== null).map(eventId => ({eventId,eventTitle: entries.find(r => r.eventId === eventId)!.eventTitle!,...totals(entries.filter(r => r.eventId === eventId))}))
    };
  }
  function getEventReport(actor: Actor, eventId: string) {
    assertPermission(actor, "events:report"); requireEvent(actor, eventId);
    const event = db.prepare("SELECT * FROM events WHERE id = ? AND club_id = ?").get(eventId,actor.clubId)!;
    const tasks = getTasks(actor, {eventId});
    const goalPaise = Number(event.fundraiser_goal_paise);
    const raisedPaise = ledgerRows(actor).filter(r => r.eventId === eventId && r.type === "income").reduce((sum,r)=>sum+r.amountPaise,0);
    return {eventId,eventTitle: String(event.title),fundraiser:{goalPaise,raisedPaise,remainingPaise:Math.max(0,goalPaise-raisedPaise),percent:goalPaise ? Math.min(100,Math.round(100*raisedPaise/goalPaise)) : 0,onTrack:goalPaise === 0 || raisedPaise >= goalPaise*0.5},
      tasks:{total:tasks.length,todo:tasks.filter(t=>t.status === "todo").length,inProgress:tasks.filter(t=>t.status === "in_progress").length,done:tasks.filter(t=>t.status === "done").length,overdue:tasks.filter(t=>t.overdue).length}};
  }
  return {getTasks,getTaskById,createTask,patchTask,updateTaskStatus,saveReceipt,getReceiptById,getReceiptFile,getExpenses,getExpenseById,submitExpense,
    approveExpense: (actor: Actor,id:string) => reviewExpense(actor,id,"approved"),
    rejectExpense: (actor: Actor,id:string,note?:string) => reviewExpense(actor,id,"rejected",note),
    payExpense,getLedgerEntries,getLedgerSummary,getEventReport};
}
