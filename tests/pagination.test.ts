import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { hashSessionToken } from "../src/lib/auth/session";
import type { CursorPage, Expense, TaskDetails } from "../src/lib/contracts";
import { getDatabase, openClubDatabase } from "../src/lib/database";
import { ForbiddenError, ValidationError } from "../src/lib/errors";
import { GET as membersRoute } from "../src/app/api/v2/members/route";
import { GET as tasksRoute } from "../src/app/api/v2/tasks/route";
import { GET as expensesRoute } from "../src/app/api/v2/expenses/route";
import { GET as ledgerRoute } from "../src/app/api/v2/ledger/entries/route";
import { GET as membersV1 } from "../src/app/api/members/route";
import { GET as tasksV1 } from "../src/app/api/tasks/route";
import { GET as expensesV1 } from "../src/app/api/expenses/route";
import { GET as ledgerV1 } from "../src/app/api/ledger/entries/route";
import { GET as summaryRoute } from "../src/app/api/ledger/summary/route";
import { GET as exportRoute } from "../src/app/api/ledger/export.csv/route";
import { GET as legacyExportRoute } from "../src/app/api/ledger/export/route";
import { actorFor, apiRequest, DEMO, FIXED_NOW, loginCookie, memoryDatabase, receiptFor, withRouteDatabase } from "./helpers";

function allPages<T extends { id: string }>(read: (cursor?: string) => CursorPage<T>): T[] {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let pages = 0; pages < 1000; pages++) {
    const page = read(cursor);
    assert.deepEqual(Object.keys(page).sort(), ["hasMore", "items", "nextCursor"]);
    assert.equal(page.hasMore, page.nextCursor !== null);
    if (page.hasMore) assert.ok(page.items.length > 0);
    rows.push(...page.items);
    if (!page.hasMore) {
      assert.equal(new Set(rows.map(row => row.id)).size, rows.length, "each record appears exactly once");
      return rows;
    }
    assert.notEqual(page.nextCursor, cursor, "the cursor advances");
    cursor = page.nextCursor!;
  }
  throw new Error("Pagination failed to terminate.");
}

function ordered<T extends { id: string }>(rows: T[], timestamp: (row: T) => string): T[] {
  return [...rows].sort((a, b) => timestamp(a) === timestamp(b)
    ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    : (timestamp(a) > timestamp(b) ? -1 : 1));
}

test("all four v2 lists traverse a fixed dataset exactly once, including timestamp ties and page boundaries", () => {
  const { db, clock } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), volunteer = actorFor(db, DEMO.volunteer);
    for (let index = 0; index < 107; index++) {
      // Seven equal-key groups exercise both parts of the keyset predicate.
      clock.now = new Date(FIXED_NOW.getTime() + Math.floor(index / 16) * 60_000);
      const member = db.createMemberAs(admin, { name: `Page student ${index}`, email: `page-${index}@example.com` });
      db.dues.recordDues(admin, { memberId: member.id, reference: `PAGE-DUES-${index}` });
      db.createTask(admin, { title: `Page task ${index}`, assigneeId: volunteer.memberId, eventId: "demo-event-1", dueAt: "2026-10-09T08:00:00.000Z" });
      db.submitExpense(volunteer, { purpose: `Page expense ${index}`, receiptId: receiptFor(db, volunteer), amountPaise: 100 + index, eventId: "demo-event-1" });
    }
    const summaryBefore = db.getLedgerSummary(admin);
    const checks = [
      { actual: allPages(cursor => db.getMembersPage(admin, { limit: 13, cursor })), expected: ordered(db.getMembers(admin.clubId), row => row.joinedAt) },
      { actual: allPages(cursor => db.getTasksPage(admin, { limit: 13, cursor })), expected: ordered(db.getTasks(admin), row => row.createdAt) },
      { actual: allPages(cursor => db.getExpensesPage(admin, { limit: 13, cursor })), expected: ordered(db.getExpenses(admin), row => row.submittedAt) },
      { actual: allPages(cursor => db.getLedgerEntriesPage(admin, { limit: 13, cursor })), expected: ordered(db.getLedgerEntries(admin), row => row.occurredAt) },
    ];
    for (const check of checks) assert.deepEqual(check.actual, check.expected);
    const memberFilters = { q: "Page", role: "member", membership: "active", limit: 3 };
    assert.equal(allPages(cursor => db.getMembersPage(admin, { ...memberFilters, cursor })).length, 107);
    const memberCursor = db.getMembersPage(admin, memberFilters).nextCursor;
    for (const changed of [{ role: "admin" }, { membership: "expired" }, { q: "different" }]) {
      assert.throws(() => db.getMembersPage(admin, { ...memberFilters, ...changed, cursor: memberCursor }), ValidationError);
    }
    const ledgerFilters = { category: "membership", kind: "income", q: "Page student", limit: 3 };
    assert.equal(allPages(cursor => db.getLedgerEntriesPage(admin, { ...ledgerFilters, cursor })).length, 107);
    const ledgerCursor = db.getLedgerEntriesPage(admin, ledgerFilters).nextCursor;
    for (const changed of [{ category: "events" }, { kind: "expense" }, { q: "different" }, { eventId: "demo-event-1" }]) {
      assert.throws(() => db.getLedgerEntriesPage(admin, { ...ledgerFilters, ...changed, cursor: ledgerCursor }), ValidationError);
    }
    for (const read of [db.getMembersPage, db.getTasksPage, db.getExpensesPage, db.getLedgerEntriesPage]) {
      assert.equal(read(admin).items.length, 25);
      assert.equal(read(admin, { limit: 100 }).items.length, 100);
      assert.equal(read(admin, { limit: 1 }).items.length, 1);
      for (const limit of [0, -1, 101, 1.5, Infinity, NaN, "", "01", "1e2", "2.0", "abc", null]) {
        assert.throws(() => read(admin, { limit }), ValidationError, String(limit));
      }
      assert.deepEqual(read(admin, { q: "no-such-record" }), { items: [], nextCursor: null, hasMore: false });
    }
    const first = db.getMembersPage(admin, { limit: 1 });
    const rest = allPages(cursor => db.getMembersPage(admin, { limit: 100, cursor: cursor ?? first.nextCursor! }));
    assert.deepEqual([...first.items, ...rest], checks[0].expected, "page size may change without restarting the list");
    assert.deepEqual(db.getLedgerSummary(admin), summaryBefore, "list paging never truncates finance totals");
    assert.equal(db.ledger.reconcile().orphans.length, 0);
  } finally { db.close(); }
});

test("filters and club/owner permissions apply before LIMIT, including newer inaccessible rows", () => {
  const { db, clock } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), volunteer = actorFor(db, DEMO.volunteer), organizer = actorFor(db, DEMO.organizer);
    const ownTasks: TaskDetails[] = [], ownExpenses: Expense[] = [];
    for (let index = 0; index < 6; index++) {
      ownTasks.push(db.createTask(admin, { title: `Literal 100%_ ${index}`, assigneeId: volunteer.memberId, eventId: "demo-event-1", dueAt: "2026-10-09T08:00:00.000Z" }));
      ownExpenses.push(db.submitExpense(volunteer, { purpose: `Literal 100%_ ${index}`, amountPaise: 500, receiptId: receiptFor(db, volunteer), eventId: "demo-event-1" }));
    }
    clock.now = new Date(FIXED_NOW.getTime() + 60_000);
    for (let index = 0; index < 30; index++) {
      const task = db.createTask(admin, { title: `Other task ${index}`, assigneeId: organizer.memberId });
      db.updateTaskStatus(admin, task.id, "done");
      db.submitExpense(organizer, { purpose: `Other expense ${index}`, amountPaise: 100, receiptId: receiptFor(db, organizer) });
    }
    assert.deepEqual(allPages(cursor => db.getTasksPage(volunteer, { limit: 2, cursor, mine: true, overdue: true, eventId: "demo-event-1", status: "todo", q: "100%_" })), ordered(ownTasks, row => row.createdAt));
    assert.deepEqual(allPages(cursor => db.getExpensesPage(volunteer, { limit: 2, cursor, eventId: "demo-event-1", status: "submitted", q: "100%_" })), ordered(ownExpenses, row => row.submittedAt));
    assert.equal(db.getExpensesPage(volunteer, { submitterId: organizer.memberId }).items.length, 0, "owner filter cannot widen permissions");
    assert.equal(db.getExpensesPage(admin, { submitterId: organizer.memberId, limit: 100 }).items.length, 30);
    const expenseFilters = { status: "submitted", submitterId: volunteer.memberId, eventId: "demo-event-1", q: "100%_", limit: 1 };
    const expenseCursor = db.getExpensesPage(admin, expenseFilters).nextCursor;
    for (const changed of [{ status: "paid" }, { submitterId: organizer.memberId }, { eventId: "demo-event-2" }, { q: "different" }]) {
      assert.throws(() => db.getExpensesPage(admin, { ...expenseFilters, ...changed, cursor: expenseCursor }), ValidationError);
    }
    assert.throws(() => db.getMembersPage(volunteer), ForbiddenError);
    assert.throws(() => db.getLedgerEntriesPage(organizer), ForbiddenError);
    assert.throws(() => db.getTasksPage(admin, { mine: true, assigneeId: volunteer.memberId }), ValidationError);

    const clubId = db.createClub("Pagination other club");
    const ownSummary = db.getLedgerSummary(admin);
    db.createMemberWithCredentials({ name: "Other lead", email: "other-page@example.com", password: "other-page-password", role: "admin", clubId });
    const other = actorFor(db, "other-page@example.com", "other-page-password");
    for (let index = 0; index < 30; index++) {
      const member = db.createMemberAs(other, { name: `Foreign ${index}`, email: `foreign-page-${index}@example.com` });
      db.dues.recordDues(other, { memberId: member.id, reference: `OTHER-${index}` });
      db.createTask(other, { title: `Foreign ${index}` });
      db.submitExpense(other, { purpose: `Foreign ${index}`, amountPaise: 100, receiptId: receiptFor(db, other) });
    }
    const lists = [db.getMembersPage, db.getTasksPage, db.getExpensesPage, db.getLedgerEntriesPage];
    for (const read of lists) {
      const own = allPages<{ id: string }>(cursor => read(admin, { limit: 2, cursor }));
      const foreign = allPages<{ id: string }>(cursor => read(other, { limit: 2, cursor }));
      const ownIds = new Set(own.map(row => row.id));
      assert.ok(foreign.length >= 30);
      assert.equal(foreign.some(row => ownIds.has(row.id)), false);
      const foreignCursor = read(other, { limit: 1 }).nextCursor;
      assert.throws(() => read(admin, { limit: 1, cursor: foreignCursor }), ValidationError);
    }
    assert.deepEqual(db.getLedgerEntriesPage(admin), { items: ordered(db.getLedgerEntries(admin), row => row.occurredAt), nextCursor: null, hasMore: false });
    assert.deepEqual(db.getLedgerSummary(admin), ownSummary, "foreign ledger rows never enter aggregate totals or groups");
    assert.ok(db.getLedgerSummary(other).inflowPaise > 0);
  } finally { db.close(); }
});

test("member date filters, paid expense filters and event/category ledger filters retain full-result semantics", () => {
  const { db, clock } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), volunteer = actorFor(db, DEMO.volunteer);
    for (let index = 0; index < 3; index++) {
      const member = db.createMemberAs(admin, { name: `Expiry ${index}`, email: `expiry-page-${index}@example.com` });
      db.dues.recordDues(admin, { memberId: member.id, reference: `EXPIRY-${index}` });
    }
    const expiry = db.getMembersPage(admin, { q: "Expiry", membership: "active", limit: 1 });
    clock.now = new Date("2030-01-01T08:00:00.000Z");
    const remainder = allPages(cursor => db.getMembersPage(admin, { q: "Expiry", membership: "active", limit: 1, cursor: cursor ?? expiry.nextCursor! }));
    assert.equal(remainder.length, 2, "continuations use the first page club date");
    assert.equal(db.getMembersPage(admin, { q: "Expiry", membership: "active" }).items.length, 0);
    assert.equal(db.getMembersPage(admin, { q: "Expiry", membership: "expired" }).items.length, 3);
    for (let index = 0; index < 5; index++) {
      const expense = db.submitExpense(volunteer, { purpose: `Paid page ${index}`, amountPaise: 250, receiptId: receiptFor(db, volunteer), eventId: "demo-event-1" });
      db.approveExpense(admin, expense.id);
      if (index < 3) db.payExpense(admin, expense.id, `PAID-PAGE-${index}`);
    }
    assert.equal(allPages(cursor => db.getExpensesPage(admin, { cursor, status: "paid", eventId: "demo-event-1", limit: 1 })).length, 3);
    const entries = allPages(cursor => db.getLedgerEntriesPage(admin, { cursor, kind: "expense", category: "expense", eventId: "demo-event-1", limit: 1 }));
    assert.equal(entries.length, 3);
    assert.equal(entries.reduce((sum, entry) => sum + entry.amountPaise, 0), 750);
    assert.equal(db.getLedgerSummary(admin).approvedUnpaidPaise, 500);
    const full = db.getLedgerEntries(admin);
    const sums = (rows: typeof full) => ({
      inflowPaise: rows.filter(row => row.kind === "income").reduce((sum, row) => sum + row.amountPaise, 0),
      outflowPaise: rows.filter(row => row.kind === "expense").reduce((sum, row) => sum + row.amountPaise, 0),
    });
    const total = sums(full);
    assert.deepEqual(db.getLedgerSummary(admin), {
      ...total, balancePaise: total.inflowPaise - total.outflowPaise, approvedUnpaidPaise: 500,
      byCategory: [...new Set(full.map(row => row.category))].map(category => ({ category, ...sums(full.filter(row => row.category === category)) })),
      byEvent: [...new Set(full.map(row => row.eventId))].filter(eventId => eventId !== null).map(eventId => ({ eventId, eventTitle: full.find(row => row.eventId === eventId)!.eventTitle, ...sums(full.filter(row => row.eventId === eventId)) })),
    }, "SQL aggregates preserve complete v1 sums and category/event order");
    assert.throws(() => db.getLedgerSummary(volunteer), ForbiddenError);
  } finally { db.close(); }
});

test("cursors reject malformed, altered, cross-list, cross-filter, cross-role and cross-login reuse", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    for (let index = 0; index < 4; index++) db.createTask(admin, { title: `Cursor task ${index}` });
    const cursor = db.getTasksPage(admin, { q: "Cursor", status: "todo", limit: 1 }).nextCursor!;
    const validInput = { q: "Cursor", status: "todo", limit: 1, cursor };
    assert.equal(db.getTasksPage(admin, validInput).items.length, 1);
    for (const malformed of ["", "nonsense", "e30", "e30.e30", cursor + "=", cursor + ".extra", cursor.slice(1), "x".repeat(4097)]) {
      assert.throws(() => db.getTasksPage(admin, { ...validInput, cursor: malformed }), ValidationError);
    }
    // Well-signed malformed payload still must pass version and position validation.
    const [body] = cursor.split(".");
    for (const patch of [{ v: 2 }, { after: { timestamp: "not-a-date", id: "id" } }, { after: { timestamp: FIXED_NOW.toISOString(), id: "" } }, { extra: true }, { sort: "createdAt_asc" }]) {
      const modified = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), ...patch })).toString("base64url");
      const signed = `${modified}.${createHmac("sha256", admin.sessionId).update(modified).digest("base64url")}`;
      assert.throws(() => db.getTasksPage(admin, { ...validInput, cursor: signed }), ValidationError);
    }
    for (const changed of [{ q: "task" }, { status: "done" }, { mine: true }, { overdue: true }, { eventId: "demo-event-1" }, { assigneeId: admin.memberId }, { sort: "createdAt_asc" }]) {
      assert.throws(() => db.getTasksPage(admin, { ...validInput, ...changed }), ValidationError);
    }
    assert.throws(() => db.getMembersPage(admin, { limit: 1, cursor }), ValidationError);
    assert.throws(() => db.getExpensesPage(admin, { limit: 1, cursor }), ValidationError);
    assert.throws(() => db.getLedgerEntriesPage(admin, { limit: 1, cursor }), ValidationError);
    assert.throws(() => db.getTasksPage({ ...admin, role: "volunteer" }, validInput), ValidationError);
    assert.throws(() => db.getTasksPage(actorFor(db, DEMO.admin), validInput), ValidationError);
  } finally { db.close(); }
});

test("list search folds ASCII case while preserving Unicode and literal LIKE metacharacters", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), volunteer = actorFor(db, DEMO.volunteer);
    const label = "Needle ÉCOLE छात्र 100%_ \\back";
    const member = db.createMemberAs(admin, { name: label, email: "search-case@example.com" });
    db.dues.recordDues(admin, { memberId: member.id, reference: "SEARCH-CASE" });
    const task = db.createTask(admin, { title: "Search by description", description: label });
    const expense = db.submitExpense(volunteer, { purpose: label, amountPaise: 100, receiptId: receiptFor(db, volunteer) });
    const reads = [db.getMembersPage, db.getTasksPage, db.getExpensesPage, db.getLedgerEntriesPage];
    for (const q of ["nEEDLE", "École", "छात्र", "100%_", "\\BACK"]) {
      for (const read of reads) assert.equal(read(admin, { q }).items.length, 1, q);
    }
    for (const q of ["école", "100xx", "\\no-such-path", "' OR 1=1 --"]) {
      for (const read of reads) assert.equal(read(admin, { q }).items.length, 0, q);
    }
    for (const read of reads) assert.throws(() => read(admin, { q: "needle\0" }), ValidationError);
    assert.equal(db.getMembersPage(admin, { q: "SEARCH-CASE@EXAMPLE.COM" }).items[0].id, member.id, "citext email columns use the same search semantics");
    assert.equal(db.getTasksPage(admin, { q: "search BY DESCRIPTION" }).items[0].id, task.id);
    assert.equal(db.getExpensesPage(admin, { q: label }).items[0].id, expense.id);
  } finally { db.close(); }
});

test("time-dependent overdue filters use the first page time", () => {
  const { db, clock } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    for (let index = 0; index < 4; index++) db.createTask(admin, { title: `Overdue ${index}`, dueAt: "2026-10-10T07:00:00.000Z" });
    db.createTask(admin, { title: "Due later", dueAt: "2026-10-10T09:00:00.000Z" });
    const first = db.getTasksPage(admin, { overdue: true, limit: 1 });
    clock.now = new Date("2026-10-11T08:00:00.000Z");
    const rest = allPages(cursor => db.getTasksPage(admin, { overdue: true, limit: 1, cursor: cursor ?? first.nextCursor! }));
    assert.equal([...first.items, ...rest].length, 4);
    assert.equal(db.getTasksPage(admin, { overdue: true }).items.length, 5);
  } finally { db.close(); }
});

test("the actual upstream v13 schema upgrades through v15 without changing records, constraints or active sessions", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-pagination-migration-"));
  const filename = join(directory, "mode.sqlite");
  const indexes = ["members_page_idx", "tasks_page_idx", "tasks_assignee_page_idx", "expenses_page_idx", "expenses_owner_page_idx", "expenses_status_page_idx", "transactions_page_idx"];
  let db: ReturnType<typeof openClubDatabase> | undefined;
  const token = "v13-existing-session-token";
  const raw = new DatabaseSync(filename);
  const snapshot = (connection: DatabaseSync) => Object.fromEntries(
    connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
      .map(({ name }) => [name, connection.prepare(`SELECT rowid, * FROM "${String(name).replace(/"/g, '""')}" ORDER BY rowid`).all()]),
  );
  let before: ReturnType<typeof snapshot>;
  let originalSchema: ReturnType<ReturnType<DatabaseSync["prepare"]>["all"]>;
  try {
    // This fixture is the published v13 schema, not a later schema with its version number lowered.
    raw.exec(readFileSync(new URL("./fixtures/upstream-v13.sql", import.meta.url), "utf8"));
    assert.equal(raw.prepare("PRAGMA user_version").get()?.user_version, 13);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE '%_page_idx'").get()?.n, 0);
    raw.prepare("INSERT INTO clubs (id, name, description, created_at, require_separate_payer) VALUES ('club-sample', 'Existing club', '', ?, 1)").run(FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO members (id, name, email, joined_at, dues_status, role, qr_token, short_code) VALUES ('v13-admin', 'Existing admin', 'v13@example.com', ?, 'unpaid', 'admin', 'v13-qr', 'V13CODE')").run(FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO sessions (id, club_id, member_id, token_hash, created_at, expires_at) VALUES ('v13-session', 'club-sample', 'v13-admin', ?, ?, '2026-10-17T08:00:00.000Z')").run(hashSessionToken(token), FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO tasks (id, title, assignee, status, assignee_id, created_at) VALUES ('v13-task', 'Existing task', 'Existing admin', 'todo', 'v13-admin', ?)").run(FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO expense_receipts (id, club_id, uploader_id, filename, mime_type, size_bytes, uploaded_at, storage_name) VALUES ('v13-receipt', 'club-sample', 'v13-admin', 'existing.pdf', 'application/pdf', 12, ?, 'v13-receipt')").run(FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO expenses (id, club_id, submitter_id, amount_paise, purpose, receipt_id, status, payment_reference, submitted_at, paid_at) VALUES ('v13-expense', 'club-sample', 'v13-admin', 100, 'Existing expense', 'v13-receipt', 'paid', 'V13-PAID', ?, ?)").run(FIXED_NOW.toISOString(), FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO transactions (id, description, kind, amount_paise, occurred_at, source_type, source_id) VALUES ('v13-income', 'Existing income', 'income', 500, ?, 'opening_balance', 'v13-income'), ('v13-outflow', 'Existing expense', 'expense', 100, ?, 'expense', 'v13-expense')").run(FIXED_NOW.toISOString(), FIXED_NOW.toISOString());
    raw.prepare("INSERT INTO login_attempts (email, failures, locked_until, updated_at) VALUES ('locked@example.com', 5, '2026-10-10T08:15:00.000Z', ?)").run(FIXED_NOW.toISOString());
    before = snapshot(raw);
    originalSchema = raw.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name").all();
  } finally { raw.close(); }
  try {
    db = openClubDatabase(filename, { now: () => FIXED_NOW });
    const admin = db.getActor(token)!;
    assert.equal(admin.memberId, "v13-admin");
    assert.equal(admin.sessionId, "v13-session");
    assert.equal(db.getMembers(admin.clubId).length, 1);
    assert.equal(db.getTasksPage(admin).items[0].id, "v13-task");
    assert.equal(db.getLedgerSummary(admin).balancePaise, 400);
    const inspect = new DatabaseSync(filename);
    try {
      assert.equal(inspect.prepare("PRAGMA user_version").get()?.user_version, 16);
      // v14 rebuilds members around people; v16 adds join_code to clubs; every other table must be untouched by v14, v15 and v16.
      const identityTables = new Set(["members", "people", "clubs"]);
      const outsideIdentity = (tables: ReturnType<typeof snapshot>) => Object.fromEntries(Object.entries(tables).filter(([name]) => !identityTables.has(name)));
      assert.deepEqual(outsideIdentity(snapshot(inspect)), outsideIdentity(before), "all pre-upgrade rows, rowids and values survive");
      assert.deepEqual(inspect.prepare("SELECT id, person_id, email FROM members").all().map(row => ({ ...row })), [{ id: "v13-admin", person_id: "v13-admin", email: "v13@example.com" }], "the member keeps its id and gains a matching person");
      const schema = inspect.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name").all();
      const outsideIdentitySchema = (rows: typeof schema) => rows.filter(row => !identityTables.has(String(row.tbl_name)) && !indexes.includes(String(row.name))).map(({ type, name, sql }) => ({ type, name, sql }));
      assert.deepEqual(outsideIdentitySchema(schema), outsideIdentitySchema(originalSchema), "v13 tables and hardening indexes stay intact"); 
      assert.deepEqual(inspect.prepare("PRAGMA foreign_key_check").all(), []);
      const names = new Set(inspect.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(row => row.name));
      for (const index of indexes) assert.ok(names.has(index));
      for (const [table, field, index] of [["members", "joined_at", "members_page_idx"], ["tasks", "created_at", "tasks_page_idx"], ["expenses", "submitted_at", "expenses_page_idx"], ["transactions", "occurred_at", "transactions_page_idx"]]) {
        const plan = inspect.prepare(`EXPLAIN QUERY PLAN SELECT * FROM ${table} WHERE club_id = ? AND ${field} <= ? AND (${field} < ? OR (${field} = ? AND id > ?)) ORDER BY ${field} DESC, id ASC LIMIT ?`)
          .all(admin.clubId, FIXED_NOW.toISOString(), FIXED_NOW.toISOString(), FIXED_NOW.toISOString(), "cursor-id", 26).map(row => String(row.detail)).join("\n");
        assert.match(plan, new RegExp(index));
        assert.match(plan, new RegExp(`\\b${field}\\s*[<>]=?\\s*\\?`), "deep pages must seek a timestamp range, not scan all earlier rows in the club");
        assert.doesNotMatch(plan, /TEMP B-TREE/, "base page sort must use its composite index");
      }
    } finally { inspect.close(); }
    db.close();
    db = openClubDatabase(filename, { now: () => FIXED_NOW });
    assert.equal(db.getActor(token)?.sessionId, "v13-session", "reopening a migrated database remains safe");
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("v2 routes reject bad queries, retain authorization, and preserve full v1 totals and CSV", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const admin = actorFor(db, DEMO.admin), volunteer = actorFor(db, DEMO.volunteer);
    const adminCookie = await loginCookie(DEMO.admin), volunteerCookie = await loginCookie(DEMO.volunteer);
    for (let index = 0; index < 31; index++) {
      const member = db.createMemberAs(admin, { name: `Route student ${index}`, email: `route-page-${index}@example.com` });
      db.dues.recordDues(admin, { memberId: member.id, reference: `ROUTE-${index}` });
      db.createTask(admin, { title: `Route task ${index}`, assigneeId: volunteer.memberId });
      db.submitExpense(volunteer, { purpose: `Route expense ${index}`, amountPaise: 100, receiptId: receiptFor(db, volunteer) });
    }
    const routes = [
      ["/api/v2/members", membersRoute], ["/api/v2/tasks", tasksRoute],
      ["/api/v2/expenses", expensesRoute], ["/api/v2/ledger/entries", ledgerRoute],
    ] as const;
    for (const [path, get] of routes) {
      assert.equal((await get(apiRequest(path))).status, 401);
      const response = await get(apiRequest(path, { cookie: adminCookie }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const page = await response.json();
      assert.equal(page.items.length, 25);
      assert.equal(page.hasMore, true);
      const next = await get(apiRequest(`${path}?cursor=${encodeURIComponent(page.nextCursor)}`, { cookie: adminCookie }));
      assert.equal(next.status, 200);
      assert.equal((await next.json()).hasMore, false);
      for (const query of ["limit=0", "limit=101", "limit=2.5", "limit=01", "limit=", "limit=1&limit=2", "cursor=broken", "q=", "q=%00", "q=a&q=b", "sort=wrong", "unknown=1"]) {
        const bad = await get(apiRequest(`${path}?${query}`, { cookie: adminCookie }));
        assert.equal(bad.status, 400, `${path}?${query}`);
        assert.equal((await bad.json()).code, "validation_failed");
      }
    }
    assert.equal((await membersRoute(apiRequest("/api/v2/members", { cookie: volunteerCookie }))).status, 403);
    assert.equal((await ledgerRoute(apiRequest("/api/v2/ledger/entries", { cookie: volunteerCookie }))).status, 403);
    for (const [path, get] of [["/api/v2/tasks?mine=maybe", tasksRoute], ["/api/v2/tasks?overdue=1", tasksRoute], ["/api/v2/tasks?status=missing", tasksRoute], ["/api/v2/members?membership=paid", membersRoute], ["/api/v2/members?role=owner", membersRoute], ["/api/v2/expenses?status=missing", expensesRoute], ["/api/v2/ledger/entries?category=missing", ledgerRoute], ["/api/v2/ledger/entries?kind=expense_paid", ledgerRoute]] as const) {
      assert.equal((await get(apiRequest(path, { cookie: adminCookie }))).status, 400, path);
    }
    for (const [path, get] of [
      ["/api/v2/tasks?eventId=%00", tasksRoute],
      ["/api/v2/tasks?assigneeId=member%00id", tasksRoute],
      ["/api/v2/expenses?eventId=event%00id", expensesRoute],
      ["/api/v2/expenses?submitterId=%00", expensesRoute],
      ["/api/v2/ledger/entries?eventId=event%00id", ledgerRoute],
    ] as const) {
      const response = await get(apiRequest(path, { cookie: adminCookie }));
      assert.equal(response.status, 400, path);
      assert.equal((await response.json()).code, "validation_failed", "NUL IDs are rejected before reaching either database");
    }
    const members = await (await membersV1(apiRequest("/api/members", { cookie: adminCookie }))).json();
    assert.ok(Array.isArray(members.members));
    assert.equal(members.members.length, db.getMembers(admin.clubId).length);
    for (const [path, get, total] of [
      ["/api/tasks", tasksV1, db.getTasks(admin).length], ["/api/expenses", expensesV1, db.getExpenses(admin).length],
      ["/api/ledger/entries", ledgerV1, db.getLedgerEntries(admin).length],
    ] as const) {
      const rows = await (await get(apiRequest(path + "?limit=1", { cookie: adminCookie }))).json();
      assert.ok(Array.isArray(rows));
      assert.equal(rows.length, total);
    }
    const summary = await (await summaryRoute(apiRequest("/api/ledger/summary?limit=1", { cookie: adminCookie }))).json();
    assert.deepEqual(summary, db.getLedgerSummary(admin));
    for (const [path, get] of [["/api/ledger/export.csv", exportRoute], ["/api/ledger/export", legacyExportRoute]] as const) {
      const csv = await get(apiRequest(path + "?limit=1", { cookie: adminCookie }));
      assert.equal(csv.status, 200);
      assert.equal((await csv.text()).split("\r\n").length, db.getLedgerEntries(admin).length + 1);
    }
  });
});
