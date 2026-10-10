import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../auth/password";
import { allocateUniqueTokens } from "../auth/tokens";
import { clubDate, addDays } from "./core";

export const DEFAULT_CLUB_ID = "club-sample";

interface Migration {
  version: number;
  up: (db: DatabaseSync, now: Date) => void;
}

/**
 * Schema history. Each entry runs once inside a single write transaction and
 * `PRAGMA user_version` records the highest applied version.
 */
const MIGRATIONS: Migration[] = [
  { version: 1, up: createStarterSchema },
  { version: 2, up: addIdentityAndRoles },
  { version: 3, up: addLedgerSourcesAndMemberPasses },
  { version: 4, up: addWorkflowSchema },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function migrate(db: DatabaseSync, now: Date): void {
  // Check inside the write transaction so simultaneous first requests cannot both seed.
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (current > SCHEMA_VERSION) throw new Error("Database schema is newer than this application supports.");
    // The delivery branch used schema version 2 for workflow tables before the
    // upstream identity migration was introduced. Upgrade that shape in place
    // before applying v3, rather than treating version numbers as compatible.
    if (current === 2 && !hasColumn(db, "members", "club_id")) ensureIdentitySchema(db, now);
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
function createStarterSchema(db: DatabaseSync, now: Date) {
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
  seedStarterDemo(db, now);
}

function seedStarterDemo(db: DatabaseSync, now: Date) {
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
export function demoPassword(): string {
  const configured = process.env.MODE_DEMO_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MODE_DEMO_PASSWORD must be set in production; the documented default is public.");
  }
  return "mode-demo-2026";
}

function addIdentityAndRoles(db: DatabaseSync, now: Date) {
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
  db.prepare("INSERT INTO clubs VALUES (?, ?, ?, ?)").run(
    DEFAULT_CLUB_ID,
    "Sample Student Club",
    "Fictional demo data for the MODE student organization starter.",
    now.toISOString(),
  );
  const passwordHash = hashPassword(demoPassword());
  const insertOfficer = db.prepare(
    "INSERT OR IGNORE INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, NULL, 'unpaid', ?, ?, ?)",
  );
  for (const officer of DEMO_OFFICERS) {
    insertOfficer.run(officer.id, officer.name, officer.email, now.toISOString(), DEFAULT_CLUB_ID, officer.role, passwordHash);
  }
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((entry) => entry.name === column);
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string): void {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

/** Idempotent identity upgrade used for databases created by the prior workflow schema. */
function ensureIdentitySchema(db: DatabaseSync, now: Date): void {
  db.exec(`CREATE TABLE IF NOT EXISTS clubs (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL);`);
  addColumnIfMissing(db, "members", "club_id", `club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}'`);
  addColumnIfMissing(db, "members", "role", "role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'volunteer', 'organizer', 'treasurer', 'admin'))");
  addColumnIfMissing(db, "members", "password_hash", "password_hash TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS members_club_idx ON members (club_id);");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(id), member_id TEXT NOT NULL REFERENCES members(id),
      token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS sessions_member_idx ON sessions (member_id);
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL REFERENCES clubs(id), actor_id TEXT REFERENCES members(id), action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT, occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (club_id, entity_type, entity_id);
  `);
  db.prepare("INSERT OR IGNORE INTO clubs VALUES (?, ?, ?, ?)").run(DEFAULT_CLUB_ID, "Sample Student Club", "Fictional demo data for the MODE student organization starter.", now.toISOString());
  const passwordHash = hashPassword(demoPassword());
  const insertOfficer = db.prepare("INSERT OR IGNORE INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, NULL, 'unpaid', ?, ?, ?)");
  for (const officer of DEMO_OFFICERS) insertOfficer.run(officer.id, officer.name, officer.email, now.toISOString(), DEFAULT_CLUB_ID, officer.role, passwordHash);
}

// ---------------------------------------------------------------------------
// v3 — P0 foundations (#2): ledger sources, opening balances, member passes, demo members
// ---------------------------------------------------------------------------
export const DEMO_MEMBERS = [
  { id: "demo-member-active", name: "Active Member Demo", email: "active@example.com", expiresInDays: 300 },
  { id: "demo-member-expired", name: "Expired Member Demo", email: "expired@example.com", expiresInDays: -10 },
] as const;

function addLedgerSourcesAndMemberPasses(db: DatabaseSync, now: Date) {
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
  const today = clubDate(now);
  const passwordHash = hashPassword(demoPassword());
  const insert = db.prepare(
    "INSERT OR IGNORE INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, ?, 'paid', ?, 'member', ?)",
  );
  for (const demo of DEMO_MEMBERS) {
    insert.run(demo.id, demo.name, demo.email, now.toISOString(), addDays(today, demo.expiresInDays), DEFAULT_CLUB_ID, passwordHash);
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
// v4 — task, receipt, reimbursement and finance-workspace compatibility
// ---------------------------------------------------------------------------
function addWorkflowSchema(db: DatabaseSync, now: Date) {
  ensureIdentitySchema(db, now);
  addColumnIfMissing(db, "events", "fundraiser_goal_paise", "fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "tasks", "assignee", "assignee TEXT");
  addColumnIfMissing(db, "tasks", "description", "description TEXT");
  addColumnIfMissing(db, "tasks", "assignee_id", "assignee_id TEXT REFERENCES members(id)");
  addColumnIfMissing(db, "tasks", "event_id", "event_id TEXT REFERENCES events(id)");
  addColumnIfMissing(db, "tasks", "due_at", "due_at TEXT");
  addColumnIfMissing(db, "tasks", "created_at", "created_at TEXT");
  db.prepare("UPDATE tasks SET assignee = COALESCE((SELECT name FROM members WHERE id = tasks.assignee_id), 'Unassigned') WHERE assignee IS NULL").run();
  db.prepare("UPDATE tasks SET created_at = ? WHERE created_at IS NULL").run(now.toISOString());
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      uploader_id TEXT NOT NULL REFERENCES members(id),
      uploader_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      uploaded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      submitter_id TEXT NOT NULL REFERENCES members(id),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      purpose TEXT NOT NULL,
      receipt_id TEXT REFERENCES receipts(id),
      receipt_reference TEXT,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')),
      rejection_note TEXT,
      payment_reference TEXT,
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS expenses_submitter_idx ON expenses (submitter_id, submitted_at DESC);
    CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status, submitted_at DESC);
  `);
}
