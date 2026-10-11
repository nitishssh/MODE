import { hashPassword } from "../auth/password";
import { allocateUniqueTokens } from "../auth/tokens";
import { clubDate, addDays, type SqlDatabase } from "./core";

export const DEFAULT_CLUB_ID = "club-sample";

/**
 * MODE_SEED=none creates a fresh database without any fictional records: just the club row
 * (named from MODE_CLUB_NAME / MODE_CLUB_DESCRIPTION) and an empty register. `npm run club:init`
 * sets this for you. The default, "demo", keeps the documented sample club for development.
 * The switch only matters when a database is first created; existing files are never re-seeded.
 */
export function seedDemoData(): boolean {
  return (process.env.MODE_SEED ?? "demo").trim().toLowerCase() !== "none";
}

function configuredClub(): { name: string; description: string } {
  const name = process.env.MODE_CLUB_NAME?.trim();
  if (!seedDemoData()) return { name: name || "Your club", description: process.env.MODE_CLUB_DESCRIPTION?.trim() ?? "" };
  return { name: "Sample Student Club", description: "Fictional demo data for the MODE student organization starter." };
}

interface Migration {
  version: number;
  up: (db: SqlDatabase, now: Date) => void;
  /** SQLite only: the migration drops and recreates tables, which needs foreign keys off outside the transaction. */
  rebuildsTables?: boolean;
}

/**
 * Schema history. Each entry runs once inside a single write transaction and
 * `PRAGMA user_version` records the highest applied version.
 */
const MIGRATIONS: Migration[] = [
  { version: 1, up: createStarterSchema },
  { version: 2, up: addIdentityAndRoles },
  { version: 3, up: addLedgerSourcesAndMemberPasses },
  { version: 4, up: addMembershipDues },
  { version: 6, up: addEventTickets },
  // Unused historical versions stay skipped; new migrations must exceed released v9.
  { version: 8, up: addMerchandiseOrders },
  { version: 9, up: addWorkspaceFlows },
  { version: 10, up: addReceiptStorageNames },
  { version: 11, up: addAnnouncementPublication },
  { version: 12, up: normalizeLegacyWorkspace },
  { version: 13, up: hardenSchema, rebuildsTables: true },
  { version: 14, up: splitPeopleFromMemberships, rebuildsTables: true },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

// P4 (#8): preserve the starter archive and reuse the existing notification/outbox tables.
function addAnnouncementPublication(db: SqlDatabase) {
  db.exec(`
    ALTER TABLE announcements ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE announcements ADD COLUMN published_by TEXT REFERENCES members(id);
    ALTER TABLE announcements ADD COLUMN idempotency_key TEXT;
    ALTER TABLE announcements ADD COLUMN recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0);
    CREATE UNIQUE INDEX announcements_request_idx ON announcements (club_id, idempotency_key);
    CREATE INDEX announcements_archive_idx ON announcements (club_id, published_at DESC, id);
    ALTER TABLE notifications ADD COLUMN announcement_id TEXT REFERENCES announcements(id);
    ALTER TABLE outbox_messages ADD COLUMN announcement_id TEXT REFERENCES announcements(id);
    CREATE UNIQUE INDEX notifications_announcement_recipient_idx ON notifications (announcement_id, member_id);
    CREATE UNIQUE INDEX outbox_announcement_recipient_idx ON outbox_messages (announcement_id, member_id);
  `);
}

/** Preserve released receipt files and claim links without filesystem moves. */
function addReceiptStorageNames(db: SqlDatabase) {
  db.exec(`
    ALTER TABLE receipts RENAME TO expense_receipts;
    ALTER TABLE expense_receipts ADD COLUMN storage_name TEXT;
    UPDATE expense_receipts SET storage_name = id;
  `);
}

function hasColumn(db: SqlDatabase, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(entry => entry.name === column);
}

function hasTable(db: SqlDatabase, table: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
}

function addColumnIfMissing(db: SqlDatabase, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

/** Preserve workflow-v2 money history without inventing the officer who paid it. */
function normalizeLegacyWorkspace(db: SqlDatabase) {
  if (hasTable(db, "tasks")) {
    addColumnIfMissing(db, "tasks", "assignee", "assignee TEXT NOT NULL DEFAULT 'Unassigned'");
    db.exec("UPDATE tasks SET assignee = COALESCE((SELECT name FROM members WHERE id = tasks.assignee_id), assignee)");
  }
  db.exec(`CREATE TABLE IF NOT EXISTS legacy_ledger_imports (
    legacy_id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
    unknown_payer INTEGER NOT NULL CHECK (unknown_payer IN (0, 1))
  )`);
  if (!hasTable(db, "ledger_entries") || !hasTable(db, "transactions") || !hasTable(db, "expenses")) return;
  const insert = db.prepare(`INSERT INTO transactions
    (id, description, kind, amount_paise, occurred_at, source_type, source_id, recorded_by, club_id, event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`);
  const record = db.prepare("INSERT INTO legacy_ledger_imports VALUES (?, ?, ?)");
  for (const row of db.prepare("SELECT * FROM ledger_entries ORDER BY id").all()) {
    const starterId = row.id === "demo-ledger-1" ? "demo-transaction-1" : row.id === "demo-ledger-2" ? "demo-transaction-2" : null;
    const starter = starterId && db.prepare("SELECT * FROM transactions WHERE id = ? AND kind = 'income' AND amount_paise = ? AND occurred_at = ? AND source_type = 'opening_balance'").get(starterId, row.amount_paise, row.occurred_at);
    if (starter && row.type === "income") {
      db.prepare("UPDATE transactions SET event_id = ? WHERE id = ?").run(row.event_id, starterId);
      record.run(row.id, starterId, 0);
      continue;
    }
    const matches = row.type === "expense_paid" ? db.prepare(`SELECT id, club_id FROM expenses
      WHERE status = 'paid' AND purpose = ? AND amount_paise = ? AND event_id IS ?
        AND payment_reference IS ? AND paid_at = ?`).all(row.description, row.amount_paise, row.event_id, row.reference, row.occurred_at) : [];
    if (matches.length > 1) throw new Error(`Ambiguous historical expense ${row.id}; migration rolled back for reconciliation.`);
    const expense = matches[0];
    const id = `legacy-entry-${row.id}`;
    insert.run(id, row.description, row.type === "income" ? "income" : "expense", row.amount_paise,
      row.occurred_at, expense ? "expense" : "opening_balance", expense?.id ?? id,
      expense?.club_id ?? DEFAULT_CLUB_ID, row.event_id);
    record.run(row.id, id, expense ? 1 : 0);
  }
  if (db.prepare("SELECT 1 FROM expenses e WHERE status = 'paid' AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.source_type = 'expense' AND t.source_id = e.id)").get()) {
    throw new Error("Historical paid expense has no matching ledger entry; migration rolled back for reconciliation.");
  }
}

function readVersion(db: SqlDatabase): number {
  return Number((db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined)?.user_version ?? 0);
}

export function migrate(db: SqlDatabase, now: Date): void {
  // A table rebuild (SQLite) must run with foreign keys off, and that PRAGMA is a no-op inside a
  // transaction; decide before BEGIN. PostgreSQL ignores the PRAGMAs and never rebuilds.
  const rebuilding = db.dialect !== "postgres" && MIGRATIONS.some((m) => m.rebuildsTables && m.version > readVersion(db));
  if (rebuilding) db.exec("PRAGMA foreign_keys = OFF");
  try {
    migrateInTransaction(db, now);
  } finally {
    if (rebuilding) {
      const violations = db.prepare("PRAGMA foreign_key_check").all();
      db.exec("PRAGMA foreign_keys = ON");
      if (violations.length) throw new Error(`Schema rebuild left ${violations.length} foreign key violation(s); restore the backup and reconcile.`);
    }
  }
}

function migrateInTransaction(db: SqlDatabase, now: Date): void {
  // Check inside the write transaction so simultaneous first requests cannot both seed.
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (current > SCHEMA_VERSION) throw new Error("Database schema is newer than this application supports.");
    if (current === 2 && !hasColumn(db, "members", "club_id")) addIdentityAndRoles(db, now);
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) continue;
      migration.up(db, now);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// v1 — starter tables and fictional seed (unchanged from the published starter)
// ---------------------------------------------------------------------------
function createStarterSchema(db: SqlDatabase, now: Date) {
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
      guest_price_paise INTEGER NOT NULL CHECK (guest_price_paise >= 0)
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
      assignee TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done'))
    );
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      occurred_at TEXT NOT NULL
    );
  `);
  if (seedDemoData()) seedStarterDemo(db, now);
}

function seedStarterDemo(db: SqlDatabase, now: Date) {
  const offset = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const insertMember = db.prepare("INSERT INTO members VALUES (?, ?, ?, ?, ?, ?)");
  insertMember.run("demo-member-1", "Asha Demo", "asha@example.com", offset(-30), offset(335).slice(0, 10), "paid");
  insertMember.run("demo-member-2", "Rohan Demo", "rohan@example.com", offset(-14), offset(351).slice(0, 10), "paid");
  insertMember.run("demo-member-3", "Meera Demo", "meera@example.com", offset(-2), null, "unpaid");

  const insertEvent = db.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertEvent.run("demo-event-1", "Welcome meetup", offset(7), "Sample campus · Room A", 60, 24, 5000, 10000);
  insertEvent.run("demo-event-2", "Community fundraiser", offset(14), "Sample campus · Courtyard", 100, 38, 10000, 15000);

  db.prepare("INSERT INTO announcements VALUES (?, ?, ?, ?)").run(
    "demo-announcement-1",
    "Welcome to the sample club",
    "These are fictional starter records. Add a member to try the working flow; other modules are previews for the team to build.",
    offset(-1),
  );
  const insertProduct = db.prepare("INSERT INTO products VALUES (?, ?, ?, ?)");
  insertProduct.run("demo-product-1", "Sample club hoodie", 79900, 18);
  insertProduct.run("demo-product-2", "Sample club T-shirt", 34900, 35);

  const insertTask = db.prepare("INSERT INTO tasks VALUES (?, ?, ?, ?)");
  insertTask.run("demo-task-1", "Prepare the welcome desk", "Asha Demo", "in_progress");
  insertTask.run("demo-task-2", "Confirm the sample venue", "Rohan Demo", "done");
  insertTask.run("demo-task-3", "Draft the fundraiser announcement", "Unassigned", "todo");

  const insertTransaction = db.prepare("INSERT INTO transactions VALUES (?, ?, ?, ?, ?)");
  insertTransaction.run("demo-transaction-1", "Sample membership dues", "income", 100000, offset(-14));
  insertTransaction.run("demo-transaction-2", "Sample ticket sales", "income", 120000, offset(-7));
  insertTransaction.run("demo-transaction-3", "Sample supplies expense", "expense", 35000, offset(-3));
}

// ---------------------------------------------------------------------------
// v2 — clubs, roles, credentials, sessions and an audit trail (#3)
// ---------------------------------------------------------------------------
export const DEMO_OFFICERS = [
  { id: "demo-officer-admin", name: "Lead Demo", email: "lead@example.com", role: "admin" },
  { id: "demo-officer-organizer", name: "Organizer Demo", email: "organizer@example.com", role: "organizer" },
  { id: "demo-officer-treasurer", name: "Treasurer Demo", email: "treasurer@example.com", role: "treasurer" },
  { id: "demo-officer-volunteer", name: "Volunteer Demo", email: "volunteer@example.com", role: "volunteer" },
] as const;

/**
 * Synthetic demo credentials. Override with MODE_DEMO_PASSWORD; never reuse for real accounts.
 * Production refuses the published default so a hosted deploy never ships a known admin password.
 */
export const PUBLIC_DEMO_PASSWORD = "mode-demo-2026";

export function demoPassword(): string {
  const configured = process.env.MODE_DEMO_PASSWORD;
  if (process.env.NODE_ENV === "production" && (!configured || configured === PUBLIC_DEMO_PASSWORD)) {
    throw new Error("MODE_DEMO_PASSWORD must be set to a private value in production; the documented default is public.");
  }
  return configured || PUBLIC_DEMO_PASSWORD;
}

function addIdentityAndRoles(db: SqlDatabase, now: Date) {
  db.exec(`
    CREATE TABLE clubs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    ALTER TABLE members ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
      CHECK (role IN ('member', 'volunteer', 'organizer', 'treasurer', 'admin'));
    ALTER TABLE members ADD COLUMN password_hash TEXT;
    CREATE INDEX members_club_idx ON members (club_id);
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX sessions_member_idx ON sessions (member_id);
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      actor_id TEXT REFERENCES members(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX audit_events_entity_idx ON audit_events (club_id, entity_type, entity_id);
  `);
  const club = configuredClub();
  db.prepare("INSERT INTO clubs VALUES (?, ?, ?, ?)").run(DEFAULT_CLUB_ID, club.name, club.description, now.toISOString());
  if (!seedDemoData()) return;
  const passwordHash = hashPassword(demoPassword());
  const insertOfficer = db.prepare(
    "INSERT OR IGNORE INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, NULL, 'unpaid', ?, ?, ?)",
  );
  for (const officer of DEMO_OFFICERS) {
    insertOfficer.run(officer.id, officer.name, officer.email, now.toISOString(), DEFAULT_CLUB_ID, officer.role, passwordHash);
  }
}

// ---------------------------------------------------------------------------
// v3 — P0 foundations (#2): ledger sources, opening balances, member passes, demo members
// ---------------------------------------------------------------------------
export const DEMO_MEMBERS = [
  { id: "demo-member-active", name: "Active Member Demo", email: "active@example.com", expiresInDays: 300 },
  { id: "demo-member-expired", name: "Expired Member Demo", email: "expired@example.com", expiresInDays: -10 },
] as const;

function addLedgerSourcesAndMemberPasses(db: SqlDatabase, now: Date) {
  db.exec(`
    ALTER TABLE transactions ADD COLUMN source_type TEXT;
    ALTER TABLE transactions ADD COLUMN source_id TEXT;
    ALTER TABLE transactions ADD COLUMN recorded_by TEXT REFERENCES members(id);
    ALTER TABLE members ADD COLUMN qr_token TEXT;
    ALTER TABLE members ADD COLUMN short_code TEXT;
  `);
  // The three starter rows predate the system: keep them, but say so honestly.
  db.exec(`
    UPDATE transactions
       SET source_type = 'opening_balance', source_id = id,
           description = 'Opening balance (pre-system): ' || description
     WHERE source_type IS NULL;
  `);
  db.exec(`
    CREATE UNIQUE INDEX transactions_source_idx ON transactions (source_type, source_id);
  `);
  if (seedDemoData()) {
    const today = clubDate(now);
    const passwordHash = hashPassword(demoPassword());
    const insert = db.prepare(
      "INSERT OR IGNORE INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, ?, 'paid', ?, 'member', ?)",
    );
    for (const demo of DEMO_MEMBERS) {
      insert.run(demo.id, demo.name, demo.email, now.toISOString(), addDays(today, demo.expiresInDays), DEFAULT_CLUB_ID, passwordHash);
    }
  }
  // Every member, old or new, gets a unique pass: QR token + short code.
  const exists = db.prepare("SELECT 1 FROM members WHERE qr_token = ? OR short_code = ?");
  const assign = db.prepare("UPDATE members SET qr_token = ?, short_code = ? WHERE id = ?");
  for (const row of db.prepare("SELECT id FROM members WHERE qr_token IS NULL OR short_code IS NULL").all()) {
    const tokens = allocateUniqueTokens((candidate) => exists.get(candidate.qrToken, candidate.shortCode) !== undefined);
    assign.run(tokens.qrToken, tokens.shortCode, String(row.id));
  }
  db.exec(`
    CREATE UNIQUE INDEX members_qr_token_idx ON members (qr_token);
    CREATE UNIQUE INDEX members_short_code_idx ON members (short_code);
  `);
}

// ---------------------------------------------------------------------------
// v4 — P1 (#4): club dues configuration, dues payments, reminders, notifications
// ---------------------------------------------------------------------------
export const DEFAULT_ANNUAL_DUES_PAISE = 50000;

function addMembershipDues(db: SqlDatabase) {
  db.exec(`
    ALTER TABLE clubs ADD COLUMN annual_dues_paise INTEGER NOT NULL DEFAULT ${DEFAULT_ANNUAL_DUES_PAISE} CHECK (annual_dues_paise > 0);
    CREATE TABLE dues_payments (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      reference TEXT NOT NULL,
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      previous_expires_on TEXT,
      new_expires_on TEXT NOT NULL,
      recorded_by TEXT NOT NULL REFERENCES members(id),
      recorded_at TEXT NOT NULL,
      UNIQUE (club_id, reference)
    );
    CREATE INDEX dues_payments_member_idx ON dues_payments (club_id, member_id);
    CREATE TABLE membership_reminders (
      member_id TEXT NOT NULL REFERENCES members(id),
      expires_on TEXT NOT NULL,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      sent_at TEXT NOT NULL,
      UNIQUE (member_id, expires_on)
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );
    CREATE INDEX notifications_member_idx ON notifications (member_id, created_at);
    CREATE TABLE outbox_messages (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT REFERENCES members(id),
      kind TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('simulated', 'pending', 'sent', 'failed')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX membership_expiry_idx ON members (club_id, expires_on);
  `);
}

// ---------------------------------------------------------------------------
// v6 — P2 (#5): event status/club scope, tickets with 30-minute holds, door check-in
// ---------------------------------------------------------------------------
function addEventTickets(db: SqlDatabase) {
  db.exec(`
    ALTER TABLE events ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled'));
    ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT '';
    CREATE INDEX events_club_idx ON events (club_id, starts_at);
    CREATE TABLE tickets (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      member_id TEXT REFERENCES members(id),
      guest_name TEXT,
      guest_email TEXT,
      pricing TEXT NOT NULL CHECK (pricing IN ('member', 'guest')),
      price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'expired')),
      hold_expires_at TEXT,
      paid_at TEXT,
      payment_reference TEXT,
      confirmed_by TEXT REFERENCES members(id),
      qr_token TEXT NOT NULL UNIQUE,
      short_code TEXT NOT NULL UNIQUE,
      checked_in_at TEXT,
      checked_in_by TEXT REFERENCES members(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK ((member_id IS NULL) + (guest_email IS NULL) = 1),
      CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL)
    );
    CREATE INDEX tickets_event_status_hold_idx ON tickets (event_id, status, hold_expires_at);
    CREATE INDEX tickets_status_hold_idx ON tickets (status, hold_expires_at);
    CREATE INDEX tickets_member_idx ON tickets (member_id, created_at);
    CREATE UNIQUE INDEX tickets_member_event_live_idx ON tickets (event_id, member_id)
      WHERE member_id IS NOT NULL AND status IN ('pending_payment', 'paid');
    CREATE UNIQUE INDEX tickets_guest_event_live_idx ON tickets (event_id, guest_email)
      WHERE guest_email IS NOT NULL AND status IN ('pending_payment', 'paid');
  `);
}

// v9 — tasks, receipts and expenses; follows released merchandise schema v8.
function addWorkspaceFlows(db: SqlDatabase, now: Date) {
  addColumnIfMissing(db, "transactions", "club_id", `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`);
  addColumnIfMissing(db, "transactions", "event_id", "event_id TEXT REFERENCES events(id)");
  addColumnIfMissing(db, "events", "fundraiser_goal_paise", "fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0 CHECK (fundraiser_goal_paise >= 0)");
  addColumnIfMissing(db, "tasks", "club_id", `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`);
  addColumnIfMissing(db, "tasks", "description", "description TEXT");
  addColumnIfMissing(db, "tasks", "assignee_id", "assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "tasks", "event_id", "event_id TEXT REFERENCES events(id) ON DELETE SET NULL");
  addColumnIfMissing(db, "tasks", "due_at", "due_at TEXT");
  addColumnIfMissing(db, "tasks", "created_at", "created_at TEXT");
  if (hasColumn(db, "tasks", "assignee")) db.exec("UPDATE tasks SET assignee_id = COALESCE(assignee_id, (SELECT id FROM members WHERE members.name = tasks.assignee LIMIT 1))");
  if (!hasTable(db, "receipts")) db.exec(`CREATE TABLE receipts (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      uploader_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      uploaded_at TEXT NOT NULL
    )`);
  else addColumnIfMissing(db, "receipts", "club_id", `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`);
  if (!hasTable(db, "expenses")) db.exec(`CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      submitter_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      purpose TEXT NOT NULL,
      receipt_id TEXT REFERENCES receipts(id),
      receipt_reference TEXT,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid'))
        DEFAULT 'submitted',
      reviewer_id TEXT REFERENCES members(id),
      rejection_note TEXT,
      payment_reference TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      paid_at TEXT
    )`);
  else {
    addColumnIfMissing(db, "expenses", "club_id", `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`);
    addColumnIfMissing(db, "expenses", "reviewer_id", "reviewer_id TEXT REFERENCES members(id)");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS tasks_club_idx ON tasks (club_id, created_at);
    CREATE INDEX IF NOT EXISTS receipts_owner_idx ON receipts (club_id, uploader_id);
    CREATE INDEX IF NOT EXISTS expenses_club_status_idx ON expenses (club_id, status, submitted_at);
    CREATE INDEX IF NOT EXISTS expenses_submitter_idx ON expenses (club_id, submitter_id, submitted_at);
  `);
  db.prepare("UPDATE tasks SET created_at = ? WHERE created_at IS NULL").run(now.toISOString());
  db.exec(`
    UPDATE transactions SET club_id = COALESCE(
      (SELECT club_id FROM dues_payments WHERE source_type = 'dues_payment' AND dues_payments.id = transactions.source_id),
      (SELECT club_id FROM tickets WHERE source_type = 'ticket' AND tickets.id = transactions.source_id),
      (SELECT club_id FROM merch_orders WHERE source_type = 'merch_order' AND merch_orders.id = transactions.source_id), club_id);
    UPDATE transactions SET event_id = (SELECT event_id FROM tickets WHERE source_type = 'ticket' AND tickets.id = transactions.source_id)
      WHERE source_type = 'ticket';
  `);
  db.prepare("UPDATE events SET fundraiser_goal_paise = ? WHERE id = ?").run(500000, "demo-event-1");
  db.prepare("UPDATE events SET fundraiser_goal_paise = ? WHERE id = ?").run(1000000, "demo-event-2");
}

// ---------------------------------------------------------------------------
// v8 — P3 (#6): size variants with their own stock, member orders with 30-minute holds
// ---------------------------------------------------------------------------
function addMerchandiseOrders(db: SqlDatabase) {
  db.exec(`
    ALTER TABLE products ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
    ALTER TABLE products ADD COLUMN member_price_paise INTEGER CHECK (member_price_paise IS NULL OR member_price_paise >= 0);
    ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));
    CREATE TABLE product_variants (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      size TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      UNIQUE (product_id, size)
    );
    CREATE INDEX product_variants_product_idx ON product_variants (product_id);
    CREATE TABLE merch_orders (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      variant_id TEXT NOT NULL REFERENCES product_variants(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
      total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
      pricing TEXT NOT NULL CHECK (pricing IN ('member', 'standard')),
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'fulfilled', 'cancelled', 'expired')),
      hold_expires_at TEXT,
      paid_at TEXT,
      payment_reference TEXT,
      confirmed_by TEXT REFERENCES members(id),
      fulfilled_at TEXT,
      fulfilled_by TEXT REFERENCES members(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (status <> 'pending_payment' OR hold_expires_at IS NOT NULL)
    );
    CREATE INDEX merch_orders_status_hold_idx ON merch_orders (status, hold_expires_at);
    CREATE INDEX merch_orders_variant_status_idx ON merch_orders (variant_id, status, member_id);
    CREATE INDEX merch_orders_member_idx ON merch_orders (member_id, created_at);
  `);
  // The starter products carry one aggregate stock; give each a single "ONE SIZE" variant holding it.
  const insert = db.prepare("INSERT INTO product_variants (id, club_id, product_id, size, stock) VALUES (?, ?, ?, 'ONE SIZE', ?)");
  for (const row of db.prepare("SELECT id, club_id, stock FROM products").all() as Array<{ id: string; club_id: string; stock: number }>) {
    insert.run(`${row.id}-one-size`, row.club_id, row.id, row.stock);
  }
}

// ---------------------------------------------------------------------------
// v13 — hardening from docs/DB-AUDIT.md: club foreign keys, receipt and payment-reference
// uniqueness, seeded-registration accounting, login throttling, purge and policy columns
// ---------------------------------------------------------------------------
const CLUB_SCOPED_TABLES_WITHOUT_FK = ["members", "events", "products", "tasks", "transactions", "announcements"] as const;

/**
 * SQLite cannot add a REFERENCES clause to an existing column, so the table is rebuilt in place
 * (the documented procedure: create new, copy with rowid, drop old, rename, recreate indexes).
 * Runs with foreign keys off; `migrate()` verifies `PRAGMA foreign_key_check` afterwards.
 */
function rebuildTable(db: SqlDatabase, table: string, transform: (sql: string) => string): void {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined;
  if (!row) throw new Error(`Cannot rebuild missing table ${table}.`);
  const transformed = transform(row.sql);
  if (transformed === row.sql) return; // already in the target shape (re-run on a downgraded test database)
  const temp = `${table}__new`;
  db.exec(transformed.replace(/^CREATE TABLE\s+"?[A-Za-z_][A-Za-z0-9_]*"?/i, `CREATE TABLE ${temp}`));
  const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => `"${c.name}"`).join(", ");
  db.exec(`INSERT INTO ${temp} (rowid, ${columns}) SELECT rowid, ${columns} FROM ${table}`);
  const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").all(table) as Array<{ sql: string }>;
  db.exec(`DROP TABLE ${table}`);
  db.exec(`ALTER TABLE ${temp} RENAME TO ${table}`);
  for (const index of indexes) db.exec(index.sql);
}

function postgresConstraintExists(db: SqlDatabase, table: string, constraint: string): boolean {
  return db.prepare("SELECT 1 FROM information_schema.table_constraints WHERE table_schema = current_schema() AND table_name = ? AND constraint_name = ?").get(table, constraint) !== undefined;
}

/**
 * Every step is idempotent and tolerant of partial historical databases (test fixtures recreate
 * only the tables they need), so a re-run after a downgrade or a crash converges on the same shape.
 */
function hardenSchema(db: SqlDatabase) {
  const postgres = db.dialect === "postgres";
  const clubScoped = CLUB_SCOPED_TABLES_WITHOUT_FK.filter((table) => hasTable(db, table) && hasColumn(db, table, "club_id"));
  // Orphans would make the new foreign keys fail half-way; refuse up front so the transaction rolls back cleanly.
  for (const table of clubScoped) {
    const orphans = Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE club_id NOT IN (SELECT id FROM clubs)`).get() as { n: number }).n);
    if (orphans) throw new Error(`${orphans} row(s) in ${table} reference a club that does not exist; migration rolled back for reconciliation.`);
  }
  if (hasTable(db, "events")) {
    addColumnIfMissing(db, "events", "seeded_registrations", "seeded_registrations INTEGER NOT NULL DEFAULT 0 CHECK (seeded_registrations >= 0)");
    // Registrations that predate the ticket table (the starter's 24 and 38) are recorded, so inventory reconciliation can tell them from drift.
    if (hasTable(db, "tickets")) {
      db.exec(`UPDATE events SET seeded_registrations = MAX(0, registered - (SELECT COUNT(*) FROM tickets t WHERE t.event_id = events.id AND t.status IN ('pending_payment', 'paid'))) WHERE seeded_registrations = 0`);
    }
  }
  if (hasTable(db, "clubs")) addColumnIfMissing(db, "clubs", "require_separate_payer", "require_separate_payer INTEGER NOT NULL DEFAULT 0 CHECK (require_separate_payer IN (0, 1))");
  // Audit #6: club_id foreign keys. Audit #20: reminders get a real primary key.
  for (const table of clubScoped) {
    if (postgres) {
      if (!postgresConstraintExists(db, table, `${table}_club_id_fkey`)) db.exec(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id)`);
    } else {
      rebuildTable(db, table, (sql) => sql.includes("REFERENCES clubs(id)") && /club_id TEXT NOT NULL DEFAULT '[^']+' REFERENCES clubs\(id\)/.test(sql)
        ? sql
        : sql.replace(`club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`, `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}' REFERENCES clubs(id)`));
    }
  }
  if (hasTable(db, "membership_reminders")) {
    if (postgres) {
      if (!postgresConstraintExists(db, "membership_reminders", "membership_reminders_pkey")) db.exec("ALTER TABLE membership_reminders ADD PRIMARY KEY (member_id, expires_on)");
    } else rebuildTable(db, "membership_reminders", (sql) => sql.replace("UNIQUE (member_id, expires_on)", "PRIMARY KEY (member_id, expires_on)"));
  }
  db.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
      locked_until TEXT,
      updated_at TEXT NOT NULL
    )`);
  const indexes: Array<[string, string[], string]> = [
    ["expenses", ["receipt_id", "status"], "CREATE UNIQUE INDEX IF NOT EXISTS expenses_receipt_live_idx ON expenses (receipt_id) WHERE receipt_id IS NOT NULL AND status <> 'rejected'"],
    ["tickets", ["club_id", "payment_reference"], "CREATE UNIQUE INDEX IF NOT EXISTS tickets_payment_reference_idx ON tickets (club_id, payment_reference) WHERE payment_reference IS NOT NULL"],
    ["merch_orders", ["club_id", "payment_reference"], "CREATE UNIQUE INDEX IF NOT EXISTS merch_orders_payment_reference_idx ON merch_orders (club_id, payment_reference) WHERE payment_reference IS NOT NULL"],
    ["expenses", ["club_id", "payment_reference"], "CREATE UNIQUE INDEX IF NOT EXISTS expenses_payment_reference_idx ON expenses (club_id, payment_reference) WHERE payment_reference IS NOT NULL"],
    ["sessions", ["expires_at"], "CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at)"],
    ["outbox_messages", ["club_id", "created_at"], "CREATE INDEX IF NOT EXISTS outbox_messages_club_created_idx ON outbox_messages (club_id, created_at)"],
    ["audit_events", ["club_id", "occurred_at"], "CREATE INDEX IF NOT EXISTS audit_events_club_time_idx ON audit_events (club_id, occurred_at)"],
  ];
  for (const [table, columns, sql] of indexes) {
    if (hasTable(db, table) && columns.every((column) => hasColumn(db, table, column))) db.exec(sql);
  }
}

// ---------------------------------------------------------------------------
// v14 — one person, many clubs: the login identity (name, email, password) moves to `people`
// and each `members` row becomes one club membership. Every foreign key that references
// members(id) keeps pointing at a club-scoped membership, so no other table changes.
// ---------------------------------------------------------------------------
function splitPeopleFromMemberships(db: SqlDatabase) {
  if (!hasTable(db, "members")) return;
  const postgres = db.dialect === "postgres";
  db.exec(`CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL
    )`);
  // Partial historical fixtures (tests recreate only the tables they need) have no identity columns to move.
  if (!["name", "email", "joined_at"].every((column) => hasColumn(db, "members", column))) return;
  addColumnIfMissing(db, "members", "person_id", "person_id TEXT REFERENCES people(id)");
  // Emails were globally unique, so each existing member becomes exactly one person with the same id.
  db.exec(`INSERT INTO people (id, name, email, password_hash, created_at)
    SELECT id, name, email, password_hash, joined_at FROM members
    WHERE person_id IS NULL AND id NOT IN (SELECT id FROM people)`);
  db.exec("UPDATE members SET person_id = id WHERE person_id IS NULL");
  // Credentials now live on the person only; a stale copy here could never be checked again.
  if (hasColumn(db, "members", "password_hash")) db.exec("UPDATE members SET password_hash = NULL");
  if (postgres) {
    db.exec("ALTER TABLE members ALTER COLUMN person_id SET NOT NULL");
    if (postgresConstraintExists(db, "members", "members_email_key")) db.exec("ALTER TABLE members DROP CONSTRAINT members_email_key");
  } else {
    rebuildTable(db, "members", (sql) => sql
      .replace(/email TEXT NOT NULL COLLATE NOCASE UNIQUE/, "email TEXT NOT NULL COLLATE NOCASE")
      .replace(/person_id TEXT REFERENCES people\(id\)/, "person_id TEXT NOT NULL REFERENCES people(id)"));
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS members_person_club_idx ON members (club_id, person_id)");
  db.exec("CREATE INDEX IF NOT EXISTS members_person_idx ON members (person_id)");
}
