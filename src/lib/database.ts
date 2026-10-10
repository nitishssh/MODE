import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdirSync as mkDir } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Announcement,
  CreateMemberInput,
  Dashboard,
  Event,
  Expense,
  ExpenseStatus,
  LedgerEntry,
  LedgerSummary,
  Member,
  PatchTaskInput,
  Product,
  Receipt,
  Task,
  TaskDetails,
  Transaction,
} from "./contracts";
import { createMemberSchema } from "./member-validation";

const SCHEMA_VERSION = 2;

export class DuplicateMemberError extends Error {
  constructor() {
    super("A member with this email address already exists.");
    this.name = "DuplicateMemberError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found.`);
    this.name = "NotFoundError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "InvalidTransitionError";
  }
}

type Row = Record<string, string | number | bigint | Uint8Array | null>;

function mapMember(row: Row): Member {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    joinedAt: String(row.joined_at),
    expiresOn: row.expires_on === null ? null : String(row.expires_on),
    duesStatus: row.dues_status as Member["duesStatus"],
  };
}

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

/** Local demo store. This file must only be imported by server code. */
export function openClubDatabase(
  filename: string,
  options: { now?: () => Date; receiptsDir?: string } = {},
) {
  const now = options.now ?? (() => new Date());
  const path = filename === ":memory:" ? filename : resolve(filename);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");

  const receiptsDir = options.receiptsDir ?? resolve(dirname(path === ":memory:" ? ".data/mode.sqlite" : path), "receipts");

  try {
    migrateAndSeed(db, now());
  } catch (error) {
    db.close();
    throw error;
  }

  // ── Members ────────────────────────────────────────────────────────────────

  function getMembers(): Member[] {
    return db
      .prepare("SELECT * FROM members ORDER BY joined_at DESC, name COLLATE NOCASE, id")
      .all()
      .map(mapMember);
  }

  function createMember(input: CreateMemberInput): Member {
    const { name, email } = createMemberSchema.parse(input);
    const member: Member = {
      id: randomUUID(),
      name,
      email,
      joinedAt: now().toISOString(),
      expiresOn: null,
      duesStatus: "unpaid",
    };
    try {
      db.prepare(
        "INSERT INTO members (id, name, email, joined_at, expires_on, dues_status) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(member.id, member.name, member.email, member.joinedAt, null, member.duesStatus);
    } catch (error) {
      if (
        error instanceof Error &&
        "errcode" in error &&
        error.errcode === 2067
      ) {
        throw new DuplicateMemberError();
      }
      throw error;
    }
    return member;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  const TASK_DETAIL_QUERY = `
    SELECT t.*, m.name AS assignee_name, e.title AS event_title
    FROM tasks t
    LEFT JOIN members m ON m.id = t.assignee_id
    LEFT JOIN events e ON e.id = t.event_id
  `;

  function getTasks(filters: {
    status?: string;
    assigneeId?: string;
    eventId?: string;
    overdue?: boolean;
    mine?: boolean;
    currentUserId?: string;
  } = {}): TaskDetails[] {
    const timestamp = now().toISOString();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.status) {
      conditions.push("t.status = ?");
      params.push(filters.status);
    }
    if (filters.assigneeId) {
      conditions.push("t.assignee_id = ?");
      params.push(filters.assigneeId);
    }
    if (filters.eventId) {
      conditions.push("t.event_id = ?");
      params.push(filters.eventId);
    }
    if (filters.overdue) {
      conditions.push("t.due_at IS NOT NULL AND t.due_at < ? AND t.status != 'done'");
      params.push(timestamp);
    }
    if (filters.mine && filters.currentUserId) {
      conditions.push("t.assignee_id = ?");
      params.push(filters.currentUserId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`${TASK_DETAIL_QUERY} ${where} ORDER BY t.created_at DESC`).all(...params);
    return rows.map((row) => mapTaskDetails(row, timestamp));
  }

  function getTaskById(id: string): TaskDetails {
    const timestamp = now().toISOString();
    const row = db.prepare(`${TASK_DETAIL_QUERY} WHERE t.id = ?`).get(id);
    if (!row) throw new NotFoundError("Task");
    return mapTaskDetails(row, timestamp);
  }

  function createTask(input: {
    title: string;
    description?: string;
    assigneeId?: string;
    eventId?: string;
    dueAt?: string;
  }): TaskDetails {
    const id = randomUUID();
    const createdAt = now().toISOString();
    db.prepare(
      "INSERT INTO tasks (id, title, description, assignee_id, event_id, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'todo', ?)"
    ).run(
      id,
      input.title.trim(),
      input.description?.trim() ?? null,
      input.assigneeId ?? null,
      input.eventId ?? null,
      input.dueAt ?? null,
      createdAt,
    );
    return getTaskById(id);
  }

  function patchTask(id: string, input: PatchTaskInput): TaskDetails {
    const existing = getTaskById(id);
    if (!existing) throw new NotFoundError("Task");
    const sets: string[] = [];
    const params: (string | null)[] = [];
    if (input.title !== undefined) { sets.push("title = ?"); params.push(input.title.trim()); }
    if (input.description !== undefined) { sets.push("description = ?"); params.push(input.description?.trim() ?? null); }
    if ("assigneeId" in input) { sets.push("assignee_id = ?"); params.push(input.assigneeId ?? null); }
    if ("eventId" in input) { sets.push("event_id = ?"); params.push(input.eventId ?? null); }
    if ("dueAt" in input) { sets.push("due_at = ?"); params.push(input.dueAt ?? null); }
    if (sets.length > 0) {
      db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    }
    return getTaskById(id);
  }

  function updateTaskStatus(id: string, status: "todo" | "in_progress" | "done"): TaskDetails {
    const existing = getTaskById(id);
    if (!existing) throw new NotFoundError("Task");
    db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
    return getTaskById(id);
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

  function saveReceipt(input: {
    uploaderId: string;
    uploaderName: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    data: Buffer;
  }): Receipt {
    const id = randomUUID();
    const uploadedAt = now().toISOString();

    // Store the file on disk
    if (path !== ":memory:") {
      mkDir(receiptsDir, { recursive: true });
      writeFileSync(join(receiptsDir, id), input.data);
    }

    db.prepare(
      "INSERT INTO receipts (id, uploader_id, uploader_name, filename, mime_type, size_bytes, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, input.uploaderId, input.uploaderName, input.filename, input.mimeType, input.sizeBytes, uploadedAt);

    return getReceiptById(id);
  }

  function getReceiptById(id: string): Receipt {
    const row = db.prepare("SELECT * FROM receipts WHERE id = ?").get(id);
    if (!row) throw new NotFoundError("Receipt");
    return {
      id: String(row.id),
      uploaderId: String(row.uploader_id),
      uploaderName: String(row.uploader_name),
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      sizeBytes: Number(row.size_bytes),
      uploadedAt: String(row.uploaded_at),
    };
  }

  function getReceiptFile(id: string): Buffer | null {
    if (path === ":memory:") return null;
    const filePath = join(receiptsDir, id);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath);
  }

  // ── Expenses ───────────────────────────────────────────────────────────────

  const EXPENSE_QUERY = `
    SELECT e.*, m.name AS submitter_name, ev.title AS event_title
    FROM expenses e
    JOIN members m ON m.id = e.submitter_id
    LEFT JOIN events ev ON ev.id = e.event_id
  `;

  function getExpenses(filters: { submitterId?: string } = {}): Expense[] {
    if (filters.submitterId) {
      return db.prepare(`${EXPENSE_QUERY} WHERE e.submitter_id = ? ORDER BY e.submitted_at DESC`).all(filters.submitterId).map(mapExpense);
    }
    return db.prepare(`${EXPENSE_QUERY} ORDER BY e.submitted_at DESC`).all().map(mapExpense);
  }

  function getExpenseById(id: string): Expense {
    const row = db.prepare(`${EXPENSE_QUERY} WHERE e.id = ?`).get(id);
    if (!row) throw new NotFoundError("Expense");
    return mapExpense(row);
  }

  function submitExpense(input: {
    submitterId: string;
    amountPaise: number;
    purpose: string;
    receiptId?: string;
    receiptReference?: string;
    eventId?: string;
  }): Expense {
    const id = randomUUID();
    const submittedAt = now().toISOString();
    // Verify submitter exists
    const member = db.prepare("SELECT id FROM members WHERE id = ?").get(input.submitterId);
    if (!member) throw new NotFoundError("Member");
    db.prepare(
      "INSERT INTO expenses (id, submitter_id, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?)"
    ).run(
      id,
      input.submitterId,
      input.amountPaise,
      input.purpose.trim(),
      input.receiptId ?? null,
      input.receiptReference ?? null,
      input.eventId ?? null,
      submittedAt,
    );
    return getExpenseById(id);
  }

  function approveExpense(id: string, reviewerId: string): Expense {
    const expense = getExpenseById(id);
    if (expense.status !== "submitted") throw new InvalidTransitionError("Only submitted expenses can be approved.");
    if (expense.submitterId === reviewerId) throw new InvalidTransitionError("You cannot approve your own expense.");
    const reviewedAt = now().toISOString();
    db.prepare("UPDATE expenses SET status = 'approved', reviewed_at = ? WHERE id = ?").run(reviewedAt, id);
    return getExpenseById(id);
  }

  function rejectExpense(id: string, reviewerId: string, note?: string): Expense {
    const expense = getExpenseById(id);
    if (expense.status !== "submitted") throw new InvalidTransitionError("Only submitted expenses can be rejected.");
    if (expense.submitterId === reviewerId) throw new InvalidTransitionError("You cannot reject your own expense.");
    const reviewedAt = now().toISOString();
    db.prepare("UPDATE expenses SET status = 'rejected', reviewed_at = ?, rejection_note = ? WHERE id = ?").run(reviewedAt, note ?? null, id);
    return getExpenseById(id);
  }

  function payExpense(id: string, paymentReference: string): Expense {
    const expense = getExpenseById(id);
    if (expense.status !== "approved") throw new InvalidTransitionError("Only approved expenses can be paid.");
    const paidAt = now().toISOString();
    // Record in ledger as an actual outflow
    const ledgerId = randomUUID();
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE expenses SET status = 'paid', paid_at = ?, payment_reference = ? WHERE id = ?").run(paidAt, paymentReference, id);
      db.prepare(
        "INSERT INTO ledger_entries (id, type, description, amount_paise, category, event_id, reference, occurred_at) VALUES (?, 'expense_paid', ?, ?, 'expense', ?, ?, ?)"
      ).run(ledgerId, expense.purpose, expense.amountPaise, expense.eventId ?? null, paymentReference, paidAt);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return getExpenseById(id);
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────

  function getLedgerSummary(): LedgerSummary {
    const inflowRow = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE type = 'income'").get();
    const outflowRow = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE type = 'expense_paid'").get();
    const approvedRow = db.prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM expenses WHERE status = 'approved'").get();
    const inflowPaise = Number(inflowRow?.total ?? 0);
    const outflowPaise = Number(outflowRow?.total ?? 0);
    const approvedUnpaidPaise = Number(approvedRow?.total ?? 0);

    const byCategoryRows = db.prepare(`
      SELECT category,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_paise ELSE 0 END), 0) AS inflow,
        COALESCE(SUM(CASE WHEN type = 'expense_paid' THEN amount_paise ELSE 0 END), 0) AS outflow
      FROM ledger_entries WHERE category IS NOT NULL GROUP BY category
    `).all();
    const byCategory = byCategoryRows.map((r) => ({
      category: String(r.category),
      inflowPaise: Number(r.inflow),
      outflowPaise: Number(r.outflow),
    }));

    const byEventRows = db.prepare(`
      SELECT l.event_id, e.title AS event_title,
        COALESCE(SUM(CASE WHEN l.type = 'income' THEN l.amount_paise ELSE 0 END), 0) AS inflow,
        COALESCE(SUM(CASE WHEN l.type = 'expense_paid' THEN l.amount_paise ELSE 0 END), 0) AS outflow
      FROM ledger_entries l
      JOIN events e ON e.id = l.event_id
      WHERE l.event_id IS NOT NULL GROUP BY l.event_id, e.title
    `).all();
    const byEvent = byEventRows.map((r) => ({
      eventId: String(r.event_id),
      eventTitle: String(r.event_title),
      inflowPaise: Number(r.inflow),
      outflowPaise: Number(r.outflow),
    }));

    return {
      inflowPaise,
      outflowPaise,
      balancePaise: inflowPaise - outflowPaise,
      approvedUnpaidPaise,
      byCategory,
      byEvent,
    };
  }

  function getLedgerEntries(): LedgerEntry[] {
    const rows = db.prepare(`
      SELECT l.*, e.title AS event_title FROM ledger_entries l
      LEFT JOIN events e ON e.id = l.event_id
      ORDER BY l.occurred_at DESC
    `).all();
    return rows.map((r) => ({
      id: String(r.id),
      type: r.type as LedgerEntry["type"],
      description: String(r.description),
      amountPaise: Number(r.amount_paise),
      category: r.category !== null ? String(r.category) : null,
      eventId: r.event_id !== null ? String(r.event_id) : null,
      eventTitle: r.event_title !== null ? String(r.event_title) : null,
      reference: r.reference !== null ? String(r.reference) : null,
      occurredAt: String(r.occurred_at),
    }));
  }

  // ── Event report ───────────────────────────────────────────────────────────

  function getEventReport(eventId: string) {
    const eventRow = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
    if (!eventRow) throw new NotFoundError("Event");
    const timestamp = now().toISOString();

    const fundraiserRow = db.prepare(`
      SELECT COALESCE(SUM(l.amount_paise), 0) AS raised
      FROM ledger_entries l WHERE l.event_id = ? AND l.type = 'income'
    `).get(eventId);

    const goalPaise = Number(eventRow.fundraiser_goal_paise ?? 0);
    const raisedPaise = Number(fundraiserRow?.raised ?? 0);
    const remainingPaise = Math.max(0, goalPaise - raisedPaise);
    const percent = goalPaise > 0 ? Math.min(100, Math.round((raisedPaise / goalPaise) * 100)) : 0;
    const onTrack = goalPaise > 0
      ? raisedPaise >= goalPaise * 0.5  // Simple heuristic: raised ≥50% of goal
      : true;

    const taskRows = db.prepare("SELECT * FROM tasks WHERE event_id = ?").all(eventId);
    const taskStats = {
      total: taskRows.length,
      todo: taskRows.filter((t) => t.status === "todo").length,
      inProgress: taskRows.filter((t) => t.status === "in_progress").length,
      done: taskRows.filter((t) => t.status === "done").length,
      overdue: taskRows.filter((t) => t.due_at !== null && t.status !== "done" && String(t.due_at) < timestamp).length,
    };

    return {
      eventId,
      eventTitle: String(eventRow.title),
      fundraiser: { goalPaise, raisedPaise, remainingPaise, percent, onTrack },
      tasks: taskStats,
    };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  function getDashboard(): Dashboard {
    const timestamp = now().toISOString();
    const today = timestamp.slice(0, 10);
    const members = getMembers();
    const events: Event[] = db.prepare("SELECT * FROM events ORDER BY starts_at, id").all().map((row) => ({
      id: String(row.id),
      title: String(row.title),
      startsAt: String(row.starts_at),
      venue: String(row.venue),
      capacity: Number(row.capacity),
      registered: Number(row.registered),
      memberPricePaise: Number(row.member_price_paise),
      guestPricePaise: Number(row.guest_price_paise),
    }));
    const announcements: Announcement[] = db.prepare("SELECT * FROM announcements ORDER BY published_at DESC, id").all().map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      publishedAt: String(row.published_at),
    }));
    const products: Product[] = db.prepare("SELECT * FROM products ORDER BY name, id").all().map((row) => ({
      id: String(row.id),
      name: String(row.name),
      pricePaise: Number(row.price_paise),
      stock: Number(row.stock),
    }));
    // Legacy simple tasks for dashboard overview
    const tasks = db.prepare("SELECT t.id, t.title, COALESCE(m.name, 'Unassigned') AS assignee, t.status FROM tasks t LEFT JOIN members m ON m.id = t.assignee_id ORDER BY t.created_at").all().map((row) => ({
      id: String(row.id),
      title: String(row.title),
      assignee: String(row.assignee),
      status: row.status as "todo" | "in_progress" | "done",
    }));
    const transactions: Transaction[] = db.prepare("SELECT * FROM transactions ORDER BY occurred_at DESC, id").all().map((row) => ({
      id: String(row.id),
      description: String(row.description),
      kind: row.kind as Transaction["kind"],
      amountPaise: Number(row.amount_paise),
      occurredAt: String(row.occurred_at),
    }));
    const balance = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE -amount_paise END), 0) AS balance FROM transactions",
    ).get();
    return {
      club: {
        name: "Skyline Student Association",
        description: "Student organization management system — task board, treasury, and events.",
      },
      metrics: {
        members: members.length,
        activeMembers: members.filter((member) => member.duesStatus === "paid" && member.expiresOn !== null && member.expiresOn >= today).length,
        upcomingEvents: events.filter((event) => event.startsAt >= timestamp).length,
        balancePaise: Number(balance?.balance ?? 0),
      },
      members,
      events,
      announcements,
      products,
      tasks,
      transactions,
    };
  }

  return {
    getMembers,
    createMember,
    getDashboard,
    getTasks,
    getTaskById,
    createTask,
    patchTask,
    updateTaskStatus,
    saveReceipt,
    getReceiptById,
    getReceiptFile,
    getExpenses,
    getExpenseById,
    submitExpense,
    approveExpense,
    rejectExpense,
    payExpense,
    getLedgerSummary,
    getLedgerEntries,
    getEventReport,
    receiptsDir,
    health: () => {
      db.prepare("SELECT 1").get();
      return { status: "ok" as const, database: "sqlite" as const, schemaVersion: SCHEMA_VERSION };
    },
    close: () => db.close(),
  };
}

export type ClubDatabase = ReturnType<typeof openClubDatabase>;

function migrateAndSeed(db: DatabaseSync, now: Date) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const version = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (version > SCHEMA_VERSION) throw new Error("Database schema is newer than this application supports.");
    if (version === 0) {
      db.exec(`
        CREATE TABLE members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          joined_at TEXT NOT NULL,
          expires_on TEXT,
          dues_status TEXT NOT NULL CHECK (dues_status IN ('paid', 'unpaid'))
        );
        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          starts_at TEXT NOT NULL,
          venue TEXT NOT NULL,
          capacity INTEGER NOT NULL CHECK (capacity >= 0),
          registered INTEGER NOT NULL CHECK (registered >= 0 AND registered <= capacity),
          member_price_paise INTEGER NOT NULL CHECK (member_price_paise >= 0),
          guest_price_paise INTEGER NOT NULL CHECK (guest_price_paise >= 0),
          fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0 CHECK (fundraiser_goal_paise >= 0)
        );
        CREATE TABLE announcements (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          published_at TEXT NOT NULL
        );
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
          stock INTEGER NOT NULL CHECK (stock >= 0)
        );
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          due_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
          created_at TEXT NOT NULL
        );
        CREATE TABLE transactions (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          occurred_at TEXT NOT NULL
        );
        CREATE TABLE receipts (
          id TEXT PRIMARY KEY,
          uploader_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
          uploader_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL
        );
        CREATE TABLE expenses (
          id TEXT PRIMARY KEY,
          submitter_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          purpose TEXT NOT NULL,
          receipt_id TEXT REFERENCES receipts(id),
          receipt_reference TEXT,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')) DEFAULT 'submitted',
          rejection_note TEXT,
          payment_reference TEXT,
          submitted_at TEXT NOT NULL,
          reviewed_at TEXT,
          paid_at TEXT
        );
        CREATE TABLE ledger_entries (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense_paid')),
          description TEXT NOT NULL,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          category TEXT,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          reference TEXT,
          occurred_at TEXT NOT NULL
        );
      `);
      seedDemo(db, now);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    } else if (version === 1) {
      // Migrate from v1: add new tables and columns
      db.exec(`
        ALTER TABLE events ADD COLUMN fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0 CHECK (fundraiser_goal_paise >= 0);
        ALTER TABLE tasks ADD COLUMN description TEXT;
        ALTER TABLE tasks ADD COLUMN assignee_id TEXT;
        ALTER TABLE tasks ADD COLUMN event_id TEXT;
        ALTER TABLE tasks ADD COLUMN due_at TEXT;
        ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
        UPDATE tasks SET assignee_id = (SELECT id FROM members WHERE name = assignee LIMIT 1);
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          uploader_id TEXT NOT NULL,
          uploader_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          submitter_id TEXT NOT NULL,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          purpose TEXT NOT NULL,
          receipt_id TEXT,
          receipt_reference TEXT,
          event_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')) DEFAULT 'submitted',
          rejection_note TEXT,
          payment_reference TEXT,
          submitted_at TEXT NOT NULL,
          reviewed_at TEXT,
          paid_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ledger_entries (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense_paid')),
          description TEXT NOT NULL,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          category TEXT,
          event_id TEXT,
          reference TEXT,
          occurred_at TEXT NOT NULL
        );
      `);
      seedDemoExpenses(db, now);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedDemo(db: DatabaseSync, now: Date) {
  const offset = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const insertMember = db.prepare("INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)");
  insertMember.run("demo-member-1", "Asha Demo", "asha@example.com", offset(-30), offset(335).slice(0, 10), "paid");
  insertMember.run("demo-member-2", "Rohan Demo", "rohan@example.com", offset(-14), offset(351).slice(0, 10), "paid");
  insertMember.run("demo-member-3", "Meera Demo", "meera@example.com", offset(-2), null, "unpaid");

  const insertEvent = db.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertEvent.run("demo-event-1", "Welcome Meetup", offset(7), "Sample Campus · Room A", 60, 24, 5000, 10000, 500000);
  insertEvent.run("demo-event-2", "Community Fundraiser", offset(14), "Sample Campus · Courtyard", 100, 38, 10000, 15000, 1000000);

  db.prepare("INSERT INTO announcements VALUES (?, ?, ?, ?)").run(
    "demo-announcement-1", "Welcome to Skyline Student Association", "These are sample records for the Skyline Student Association workspace. Add a member to try the live flow — other modules are in active development.", offset(-1),
  );
  const insertProduct = db.prepare("INSERT INTO products VALUES (?, ?, ?, ?)");
  insertProduct.run("demo-product-1", "Skyline Club Hoodie", 79900, 18);
  insertProduct.run("demo-product-2", "Skyline Club T-shirt", 34900, 35);

  const insertTask = db.prepare("INSERT INTO tasks (id, title, description, assignee_id, event_id, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertTask.run("demo-task-1", "Prepare the welcome desk", "Set up registration table and name badges", "demo-member-1", "demo-event-1", offset(5), "in_progress", offset(-5));
  insertTask.run("demo-task-2", "Confirm the venue booking", "Coordinate with facility management for room access", "demo-member-2", "demo-event-1", offset(-1), "done", offset(-10));
  insertTask.run("demo-task-3", "Draft the fundraiser announcement", "Write and review the public-facing copy", null, "demo-event-2", offset(10), "todo", offset(-3));
  insertTask.run("demo-task-4", "Set up the donation table", "Position banners and payment QR codes", "demo-member-1", "demo-event-2", offset(12), "todo", offset(-1));

  const insertTransaction = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?)");
  insertTransaction.run("demo-transaction-1", "Membership dues collection", "income", 100000, offset(-14));
  insertTransaction.run("demo-transaction-2", "Ticket sales — Welcome Meetup", "income", 120000, offset(-7));
  insertTransaction.run("demo-transaction-3", "Stationery and supplies", "expense", 35000, offset(-3));

  // Seed ledger entries from transactions
  const insertLedger = db.prepare("INSERT INTO ledger_entries (id, type, description, amount_paise, category, event_id, reference, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertLedger.run("demo-ledger-1", "income", "Membership dues collection", 100000, "membership", null, null, offset(-14));
  insertLedger.run("demo-ledger-2", "income", "Ticket sales — Welcome Meetup", 120000, "events", "demo-event-1", null, offset(-7));

  // Seed demo expenses
  seedDemoExpenses(db, now);
}

function seedDemoExpenses(db: DatabaseSync, now: Date) {
  const offset = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  // Only seed if no expenses exist yet
  const count = Number(db.prepare("SELECT COUNT(*) AS c FROM expenses").get()?.c ?? 0);
  if (count > 0) return;

  const insertExpense = db.prepare(
    "INSERT INTO expenses (id, submitter_id, amount_paise, purpose, receipt_id, receipt_reference, event_id, status, rejection_note, payment_reference, submitted_at, reviewed_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  // Paid expense
  insertExpense.run("demo-expense-1", "demo-member-1", 25000, "Printed name badges and lanyards", null, "INV-2026-001", "demo-event-1", "paid", null, "UPI-REF-123456", offset(-12), offset(-10), offset(-8));
  // Approved but unpaid
  insertExpense.run("demo-expense-2", "demo-member-2", 18000, "Poster printing and venue banners", null, "INV-2026-002", "demo-event-2", "approved", null, null, offset(-5), offset(-3), null);
  // Submitted (pending)
  insertExpense.run("demo-expense-3", "demo-member-3", 12000, "Refreshments for planning committee", null, null, null, "submitted", null, null, offset(-2), null, null);
  // Rejected
  insertExpense.run("demo-expense-4", "demo-member-1", 75000, "Photography equipment rental", null, "INV-2026-003", "demo-event-1", "rejected", "Amount exceeds the approved budget. Please get prior approval for amounts over ₹500.", null, offset(-7), offset(-6), null);

  // Seed paid expense into ledger
  const count2 = Number(db.prepare("SELECT COUNT(*) AS c FROM ledger_entries WHERE type = 'expense_paid'").get()?.c ?? 0);
  if (count2 === 0) {
    db.prepare(
      "INSERT INTO ledger_entries (id, type, description, amount_paise, category, event_id, reference, occurred_at) VALUES (?, 'expense_paid', ?, ?, 'expense', ?, ?, ?)"
    ).run("demo-ledger-exp-1", "Printed name badges and lanyards", 25000, "demo-event-1", "UPI-REF-123456", offset(-8));
  }
}

// Reuse one connection across route calls and Next.js development reloads.
const globalStore = globalThis as typeof globalThis & { modeDatabase?: ClubDatabase; modeDatabasePath?: string };

export function getDatabase(): ClubDatabase {
  const path = process.env.SQLITE_PATH || ".data/mode.sqlite";
  if (!globalStore.modeDatabase || globalStore.modeDatabasePath !== path) {
    globalStore.modeDatabase?.close();
    globalStore.modeDatabase = openClubDatabase(path);
    globalStore.modeDatabasePath = path;
  }
  return globalStore.modeDatabase;
}
