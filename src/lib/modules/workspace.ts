import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { MAX_RECEIPT_SIZE_BYTES, type Expense, type ExpenseStatus, type ExpenseLedgerEntry, type LedgerSummary, type LedgerSource, type Receipt, type TaskDetails, type CreateTaskInput, type PatchTaskInput, type SubmitExpenseInput } from "../contracts";
import { SQLITE_CONSTRAINT_UNIQUE, isConstraintError, transaction, type DbContext, type Row } from "../db/core";
import { hasPermission } from "../auth/permissions";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { postLedgerEntry } from "./ledger";
import { parseInput } from "../validation";
import { containsText, containsTextPredicate, cursorPage, expensesPageSchema, ledgerPageSchema, pageContext, tasksPageSchema } from "../pagination";

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
  const receiptHasUploaderName = (db.prepare("PRAGMA table_info(expense_receipts)").all() as Row[]).some(row => row.name === "uploader_name");
  function requireEvent(actor: Actor, id?: string | null) {
    if (id && !db.prepare("SELECT 1 FROM events WHERE id = ? AND club_id = ?").get(id, actor.clubId)) throw new NotFoundError("Event not found.");
  }
  function assignee(actor: Actor, id?: string | null) {
    return id ? identity.requireMember(actor.clubId, id).name : "Unassigned";
  }
  const taskQuery = `SELECT t.*, m.name AS assignee_name, e.title AS event_title FROM tasks t
    LEFT JOIN members m ON m.id = t.assignee_id AND m.club_id = t.club_id
    LEFT JOIN events e ON e.id = t.event_id AND e.club_id = t.club_id`;
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
  function getTasksPage(actor: Actor, input: unknown = {}) {
    const filters = parseInput(tasksPageSchema, input);
    const page = pageContext(actor, "tasks", filters, now());
    const clauses = ["t.club_id = ?"], values: (string | number)[] = [actor.clubId];
    for (const [column, value] of [["t.status", filters.status], ["t.assignee_id", filters.mine ? actor.memberId : filters.assigneeId], ["t.event_id", filters.eventId]]) {
      if (value) { clauses.push(column + " = ?"); values.push(value); }
    }
    if (filters.overdue) { clauses.push("t.due_at < ? AND t.status != 'done'"); values.push(page.asOf); }
    if (filters.q) { clauses.push(`(${containsTextPredicate("t.title", db)} OR ${containsTextPredicate("t.description", db)})`); values.push(containsText(filters.q), containsText(filters.q)); }
    if (page.after) {
      clauses.push("t.created_at <= ? AND (t.created_at < ? OR (t.created_at = ? AND t.id > ?))");
      values.push(page.after.timestamp, page.after.timestamp, page.after.timestamp, page.after.id);
    }
    const rows = db.prepare(taskQuery + " WHERE " + clauses.join(" AND ") + " ORDER BY t.created_at DESC, t.id ASC LIMIT ?")
      .all(...values, page.limit + 1).map(row => mapTaskDetails(row, page.asOf));
    return cursorPage(rows, page, task => ({ timestamp: task.createdAt, id: task.id }));
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
      if (!hasPermission(actor.role, "tasks:write") && task.assigneeId !== actor.memberId) throw new ForbiddenError();
      db.prepare("UPDATE tasks SET status = ? WHERE id = ? AND club_id = ?").run(status, id, actor.clubId);
      identity.recordAudit(actor, "task.status_updated", "task", id, { status });
      return getTaskById(actor, id);
    });
  }
  function getReceiptById(actor: Actor, id: string): Receipt {
    const row = db.prepare("SELECT r.*, m.name AS uploader_name FROM expense_receipts r JOIN members m ON m.id = r.uploader_id WHERE r.id = ? AND r.club_id = ?").get(id, actor.clubId);
    if (!row) throw new NotFoundError("Receipt not found.");
    if (row.uploader_id !== actor.memberId && !hasPermission(actor.role, "expenses:review")) throw new ForbiddenError();
    return {id: String(row.id), uploaderId: String(row.uploader_id), uploaderName: String(row.uploader_name), filename: String(row.filename), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), uploadedAt: String(row.uploaded_at)};
  }
  function saveReceipt(actor: Actor, input: {filename: string; mimeType: string; sizeBytes: number; data: Buffer}) {
    assertPermission(actor, "expenses:submit");
    const size = input.data.byteLength;
    if (size === 0) throw new ValidationError("File must not be empty.");
    if (size > MAX_RECEIPT_SIZE_BYTES) throw new DomainError("File is too large. Maximum size is 5 MB.", 413, "receipt_too_large");
    // Detect from bytes at the domain boundary, including non-HTTP callers.
    const formats = [
      { signature: Buffer.from([0xff, 0xd8, 0xff]), mime: "image/jpeg", ext: "jpg" },
      { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), mime: "image/png", ext: "png" },
      { signature: Buffer.from("%PDF-"), mime: "application/pdf", ext: "pdf" },
    ];
    const format = formats.find(f => input.data.subarray(0, f.signature.length).equals(f.signature));
    if (!format) throw new DomainError("Unsupported file type. Upload a JPG, PNG, or PDF.", 415, "receipt_type");
    const id = randomUUID();
    const storageName = `${id}.${format.ext}`;
    const basename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]*$/, "").slice(0, 150) || "receipt";
    const filename = `${basename}.${format.ext}`;
    mkdirSync(receiptsDir, { recursive: true });
    // Runtime user uploads are persistent data, not files to bundle at build time.
    writeFileSync(join(/* turbopackIgnore: true */ receiptsDir, storageName), input.data, { flag: "wx" });
    try {
      return transaction(ctx, () => {
        if (receiptHasUploaderName) {
          db.prepare("INSERT INTO expense_receipts (id, club_id, uploader_id, uploader_name, filename, mime_type, size_bytes, uploaded_at, storage_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id, actor.clubId, actor.memberId, actor.name, filename, format.mime, size, now().toISOString(), storageName);
        } else {
          db.prepare("INSERT INTO expense_receipts (id, club_id, uploader_id, filename, mime_type, size_bytes, uploaded_at, storage_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id, actor.clubId, actor.memberId, filename, format.mime, size, now().toISOString(), storageName);
        }
        return getReceiptById(actor, id);
      });
    } catch (error) {
      try { unlinkSync(join(/* turbopackIgnore: true */ receiptsDir, storageName)); } catch (cleanupError) { console.error("Receipt cleanup failed", cleanupError); }
      throw error;
    }
  }
  function getReceiptFile(actor: Actor, id: string) {
    getReceiptById(actor, id);
    const row = db.prepare("SELECT storage_name FROM expense_receipts WHERE id = ? AND club_id = ?").get(id, actor.clubId)!;
    const storageName = String(row.storage_name);
    if (!/^(?:[a-f0-9-]{36}(?:\.(?:jpg|png|pdf|webp))?|[a-z0-9_-]{1,128})$/i.test(storageName)) throw new NotFoundError("Receipt file not found.");
    try { return readFileSync(join(/* turbopackIgnore: true */ receiptsDir, storageName)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  const expenseQuery = `SELECT e.*, m.name AS submitter_name, ev.title AS event_title FROM expenses e
    JOIN members m ON m.id = e.submitter_id AND m.club_id = e.club_id
    LEFT JOIN events ev ON ev.id = e.event_id AND ev.club_id = e.club_id`;
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
  function getExpensesPage(actor: Actor, input: unknown = {}) {
    assertPermission(actor, "expenses:submit");
    const filters = parseInput(expensesPageSchema, input);
    const page = pageContext(actor, "expenses", filters, now());
    const clauses = ["e.club_id = ?"], values: (string | number)[] = [actor.clubId];
    // Own-only access is a separate predicate; a submitter filter cannot widen it.
    if (!hasPermission(actor.role, "expenses:review")) { clauses.push("e.submitter_id = ?"); values.push(actor.memberId); }
    for (const [column, value] of [["e.status", filters.status], ["e.submitter_id", filters.submitterId], ["e.event_id", filters.eventId]]) {
      if (value) { clauses.push(column + " = ?"); values.push(value); }
    }
    if (filters.q) { clauses.push(containsTextPredicate("e.purpose", db)); values.push(containsText(filters.q)); }
    if (page.after) {
      clauses.push("e.submitted_at <= ? AND (e.submitted_at < ? OR (e.submitted_at = ? AND e.id > ?))");
      values.push(page.after.timestamp, page.after.timestamp, page.after.timestamp, page.after.id);
    }
    const rows = db.prepare(expenseQuery + " WHERE " + clauses.join(" AND ") + " ORDER BY e.submitted_at DESC, e.id ASC LIMIT ?")
      .all(...values, page.limit + 1).map(mapExpense);
    return cursorPage(rows, page, expense => ({ timestamp: expense.submittedAt, id: expense.id }));
  }
  function submitExpense(actor: Actor, input: SubmitExpenseInput) {
    assertPermission(actor, "expenses:submit");
    if (!input.receiptId) throw new ValidationError("A receipt is required.", [{field: "receiptId", message: "Upload a receipt."}]);
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new ValidationError("Amount must be positive integer paise.");
    if (typeof input.purpose !== "string" || input.purpose.trim().length < 3 || input.purpose.trim().length > 500) throw new ValidationError("Purpose must be 3–500 characters.");
    return transaction(ctx, () => {
      if (input.submissionId) {
        const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(input.submissionId);
        if (existing) {
          if (existing.club_id !== actor.clubId || existing.submitter_id !== actor.memberId || existing.amount_paise !== input.amountPaise || existing.purpose !== input.purpose.trim() || existing.receipt_id !== input.receiptId || existing.receipt_reference !== (input.receiptReference ?? null) || existing.event_id !== (input.eventId ?? null)) {
            throw new ConflictError("This submission was already recorded with different details. Refresh your claims before starting a new submission.");
          }
          return getExpenseById(actor, String(existing.id));
        }
      }
      requireEvent(actor, input.eventId);
      if (getReceiptById(actor, input.receiptId).uploaderId !== actor.memberId) throw new ForbiddenError("Use your own receipt.");
      if (!getReceiptFile(actor, input.receiptId)) throw new NotFoundError("Receipt file not found. Upload it again.");
      // One receipt backs one live claim (audit #2); a rejected claim frees it. The partial UNIQUE index is the backstop.
      if (db.prepare("SELECT 1 FROM expenses WHERE receipt_id = ? AND status <> 'rejected'").get(input.receiptId)) {
        throw new ConflictError("This receipt already backs another claim.", "receipt_already_claimed");
      }
      const id = input.submissionId ?? randomUUID();
      try {
        db.prepare("INSERT INTO expenses (id, club_id, submitter_id, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)")
          .run(id, actor.clubId, actor.memberId, input.amountPaise, input.purpose.trim(), input.receiptId ?? null, input.receiptReference ?? null, input.eventId ?? null, now().toISOString());
      } catch (error) {
        if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new ConflictError("This receipt already backs another claim.", "receipt_already_claimed");
        throw error;
      }
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
      // One external transfer settles one claim (audit #3).
      if (db.prepare("SELECT 1 FROM expenses WHERE club_id = ? AND payment_reference = ? AND id <> ?").get(actor.clubId, paymentReference, id)) {
        throw new ConflictError("This payment reference is already recorded against another claim.", "payment_reference_reused");
      }
      // Separation of duties (audit #14), opt-in per club because a one-treasurer club cannot satisfy it.
      const policy = db.prepare("SELECT require_separate_payer FROM clubs WHERE id = ?").get(actor.clubId);
      const reviewer = db.prepare("SELECT reviewer_id FROM expenses WHERE id = ?").get(id);
      if (Number(policy?.require_separate_payer) === 1 && reviewer?.reviewer_id === actor.memberId) {
        throw new ForbiddenError("The officer who approved this claim cannot also pay it.");
      }
      const changed = db.prepare("UPDATE expenses SET status = 'paid', paid_at = ?, payment_reference = ? WHERE id = ? AND club_id = ? AND status = 'approved'")
        .run(now().toISOString(), paymentReference, id, actor.clubId);
      if (Number(changed.changes) !== 1) throw new ConflictError("Only approved expenses can be paid.");
      postLedgerEntry(ctx, {kind: "expense", amountPaise: expense.amountPaise, description: expense.purpose, source: {type: "expense", id}, recordedBy: actor.memberId, clubId: actor.clubId, eventId: expense.eventId});
      identity.recordAudit(actor, "expense.paid", "expense", id, {paymentReference});
      return getExpenseById(actor, id);
    });
  }
  /** Admin toggle for the approve/pay separation (audit #14). */
  function setRequireSeparatePayer(actor: Actor, enabled: boolean): void {
    assertPermission(actor, "roles:manage");
    transaction(ctx, () => {
      db.prepare("UPDATE clubs SET require_separate_payer = ? WHERE id = ?").run(enabled ? 1 : 0, actor.clubId);
      identity.recordAudit(actor, "club.policy_updated", "club", actor.clubId, { requireSeparatePayer: enabled });
    });
  }
  const ledgerQuery = `SELECT l.*, e.title AS event_title, officer.name AS officer_name,
      COALESCE(x.payment_reference, tk.payment_reference, dp.reference, mo.payment_reference) AS payment_reference
      FROM transactions l LEFT JOIN events e ON e.id = l.event_id AND e.club_id = l.club_id
      LEFT JOIN members officer ON officer.id = l.recorded_by AND officer.club_id = l.club_id
      LEFT JOIN expenses x ON l.source_type = 'expense' AND x.id = l.source_id AND x.club_id = l.club_id
      LEFT JOIN tickets tk ON l.source_type = 'ticket' AND tk.id = l.source_id AND tk.club_id = l.club_id
      LEFT JOIN dues_payments dp ON l.source_type = 'dues_payment' AND dp.id = l.source_id AND dp.club_id = l.club_id
      LEFT JOIN merch_orders mo ON l.source_type = 'merch_order' AND mo.id = l.source_id AND mo.club_id = l.club_id`;
  function mapWorkspaceLedgerEntry(row: Row): ExpenseLedgerEntry {
    return {
        id: String(row.id), type: row.kind === "income" ? "income" : "expense_paid",
        kind: row.kind as "income" | "expense", description: String(row.description), amountPaise: Number(row.amount_paise),
        category: row.source_type === "dues_payment" ? "membership" : row.source_type === "ticket" ? "events" : String(row.source_type),
        eventId: row.event_id === null ? null : String(row.event_id), eventTitle: row.event_title === null ? null : String(row.event_title),
        reference: row.payment_reference === null ? null : String(row.payment_reference), occurredAt: String(row.occurred_at),
        sourceType: String(row.source_type), sourceId: row.source_type === "opening_balance" ? null : String(row.source_id),
        recordedBy: row.recorded_by === null ? null : String(row.recorded_by),
        recordedByName: row.officer_name === null ? null : String(row.officer_name),
    };
  }
  function ledgerRows(actor: Actor): ExpenseLedgerEntry[] {
    return db.prepare(ledgerQuery + " WHERE l.club_id = ? ORDER BY l.occurred_at DESC, l.rowid DESC")
      .all(actor.clubId).map(mapWorkspaceLedgerEntry);
  }
  function getLedgerEntries(actor: Actor) { assertPermission(actor, "ledger:read"); return ledgerRows(actor); }
  function getLedgerEntriesPage(actor: Actor, input: unknown = {}) {
    assertPermission(actor, "ledger:read");
    const filters = parseInput(ledgerPageSchema, input);
    const page = pageContext(actor, "ledger", filters, now());
    const clauses = ["l.club_id = ?"], values: (string | number)[] = [actor.clubId];
    for (const [column, value] of [["l.kind", filters.kind], ["l.event_id", filters.eventId]]) {
      if (value) { clauses.push(column + " = ?"); values.push(value); }
    }
    if (filters.category) {
      clauses.push("l.source_type = ?");
      values.push(filters.category === "membership" ? "dues_payment" : filters.category === "events" ? "ticket" : filters.category);
    }
    if (filters.q) { clauses.push(containsTextPredicate("l.description", db)); values.push(containsText(filters.q)); }
    if (page.after) {
      clauses.push("l.occurred_at <= ? AND (l.occurred_at < ? OR (l.occurred_at = ? AND l.id > ?))");
      values.push(page.after.timestamp, page.after.timestamp, page.after.timestamp, page.after.id);
    }
    const rows = db.prepare(ledgerQuery + " WHERE " + clauses.join(" AND ") + " ORDER BY l.occurred_at DESC, l.id ASC LIMIT ?")
      .all(...values, page.limit + 1).map(mapWorkspaceLedgerEntry);
    return cursorPage(rows, page, entry => ({ timestamp: entry.occurredAt, id: entry.id }));
  }
  function getLedgerSource(actor: Actor, entryId: string): LedgerSource {
    assertPermission(actor, "ledger:read");
    const entry = db.prepare("SELECT * FROM transactions WHERE id = ? AND club_id = ?").get(entryId, actor.clubId);
    if (!entry || entry.source_type === "opening_balance") throw new NotFoundError("Source not found.");
    let source: Row | undefined;
    let receiptId: string | null = null;
    switch (entry.source_type) {
      case "expense": {
        const expense = db.prepare("SELECT e.*, m.name AS submitter_name FROM expenses e JOIN members m ON m.id = e.submitter_id WHERE e.id = ? AND e.club_id = ?").get(entry.source_id, actor.clubId);
        if (expense) {
          source = { Submitter: expense.submitter_name, Purpose: expense.purpose, Status: expense.status, Reference: expense.payment_reference, Paid: expense.paid_at };
          if (expense.receipt_id && (expense.submitter_id === actor.memberId || hasPermission(actor.role, "expenses:review"))) receiptId = String(expense.receipt_id);
        }
        break;
      }
      case "dues_payment":
        source = db.prepare("SELECT m.name AS Member, d.reference AS Reference, d.recorded_at AS Recorded, d.new_expires_on AS 'Membership expires' FROM dues_payments d JOIN members m ON m.id = d.member_id WHERE d.id = ? AND d.club_id = ?").get(entry.source_id, actor.clubId);
        break;
      case "ticket":
        source = db.prepare("SELECT COALESCE(m.name, t.guest_name) AS Holder, e.title AS Event, t.short_code AS 'Ticket code', t.status AS Status, t.payment_reference AS Reference FROM tickets t JOIN events e ON e.id = t.event_id LEFT JOIN members m ON m.id = t.member_id WHERE t.id = ? AND t.club_id = ?").get(entry.source_id, actor.clubId);
        break;
      case "merch_order":
        source = db.prepare("SELECT m.name AS Member, p.name AS Product, v.size AS Size, o.quantity AS Quantity, o.status AS Status, o.payment_reference AS Reference FROM merch_orders o JOIN members m ON m.id = o.member_id JOIN products p ON p.id = o.product_id JOIN product_variants v ON v.id = o.variant_id WHERE o.id = ? AND o.club_id = ?").get(entry.source_id, actor.clubId);
        break;
    }
    if (!source) throw new NotFoundError("Source not found.");
    return {
      type: String(entry.source_type), id: String(entry.source_id), title: String(entry.description), receiptId,
      details: Object.entries(source).map(([label, value]) => ({ label, value: value === null ? "—" : String(value) })),
    };
  }
  function getLedgerSummary(actor: Actor): LedgerSummary {
    assertPermission(actor, "ledger:read");
    // Aggregate the entire authorized ledger in SQL; page limits never enter here.
    const amounts = `COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_paise ELSE 0 END), 0) AS outflow`;
    const totals = db.prepare(`SELECT ${amounts},
      (SELECT COALESCE(SUM(amount_paise), 0) FROM expenses WHERE club_id = ? AND status = 'approved') AS approved
      FROM transactions WHERE club_id = ?`).get(actor.clubId, actor.clubId)!;
    // Preserve v1 group order: first appearance in occurred_at DESC, rowid DESC.
    const scoped = `WITH scoped AS (SELECT kind, amount_paise, event_id,
      CASE source_type WHEN 'dues_payment' THEN 'membership' WHEN 'ticket' THEN 'events' ELSE COALESCE(source_type, 'null') END AS category,
      ROW_NUMBER() OVER (ORDER BY occurred_at DESC, rowid DESC) AS ordinal
      FROM transactions WHERE club_id = ?)`;
    const byCategory = db.prepare(`${scoped} SELECT category, ${amounts}
      FROM scoped GROUP BY category ORDER BY MIN(ordinal)`).all(actor.clubId);
    const byEvent = db.prepare(`${scoped} SELECT event_id, e.title AS event_title, ${amounts}
      FROM scoped LEFT JOIN events e ON e.id = scoped.event_id AND e.club_id = ?
      WHERE event_id IS NOT NULL GROUP BY event_id, e.title ORDER BY MIN(ordinal)`).all(actor.clubId, actor.clubId);
    const inflowPaise = Number(totals.inflow), outflowPaise = Number(totals.outflow);
    return { inflowPaise, outflowPaise, balancePaise: inflowPaise - outflowPaise, approvedUnpaidPaise: Number(totals.approved),
      byCategory: byCategory.map(row => ({ category: String(row.category), inflowPaise: Number(row.inflow), outflowPaise: Number(row.outflow) })),
      byEvent: byEvent.map(row => ({ eventId: String(row.event_id), eventTitle: row.event_title as string, inflowPaise: Number(row.inflow), outflowPaise: Number(row.outflow) })),
    };
  }
  function getEventReport(actor: Actor, eventId: string) {
    assertPermission(actor, "events:report"); requireEvent(actor, eventId);
    const event = db.prepare("SELECT * FROM events WHERE id = ? AND club_id = ?").get(eventId,actor.clubId)!;
    const tasks = getTasks(actor, {eventId});
    const goalPaise = Number(event.fundraiser_goal_paise);
    const raisedPaise = ledgerRows(actor).filter(r => r.eventId === eventId && r.type === "income").reduce((sum,r)=>sum+r.amountPaise,0);
    return {eventId,eventTitle: String(event.title),fundraiser:{goalPaise,raisedPaise,remainingPaise:Math.max(0,goalPaise-raisedPaise),percent:goalPaise ? Math.min(100,Math.round(100*raisedPaise/goalPaise)) : 0,onTrack:goalPaise > 0 && raisedPaise >= goalPaise*0.5},
      tasks:{total:tasks.length,todo:tasks.filter(t=>t.status === "todo").length,inProgress:tasks.filter(t=>t.status === "in_progress").length,done:tasks.filter(t=>t.status === "done").length,overdue:tasks.filter(t=>t.overdue).length}};
  }
  return {getTasks,getTasksPage,getTaskById,createTask,patchTask,updateTaskStatus,saveReceipt,getReceiptById,getReceiptFile,getExpenses,getExpensesPage,getExpenseById,submitExpense,
    approveExpense: (actor: Actor,id:string) => reviewExpense(actor,id,"approved"),
    rejectExpense: (actor: Actor,id:string,note?:string) => reviewExpense(actor,id,"rejected",note),
    payExpense,setRequireSeparatePayer,getLedgerEntries,getLedgerEntriesPage,getLedgerSource,getLedgerSummary,getEventReport};
}

