import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../auth/password";

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
  { version: 3, up: addMembershipLifecycle },
  { version: 4, up: addEventTicketing },
  { version: 5, up: addMerchandiseOrders },
  { version: 6, up: addTreasuryWorkflow },
  { version: 7, up: addAnnouncementPublishing },
  { version: 8, up: addVolunteerTasks },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function migrate(db: DatabaseSync, now: Date): void {
  // Check inside the write transaction so simultaneous first requests cannot both seed.
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = Number(db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (current > SCHEMA_VERSION) throw new Error("Database schema is newer than this application supports.");
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

/** Synthetic demo credentials. Override with MODE_DEMO_PASSWORD; never reuse for real accounts. */
export function demoPassword(): string {
  return process.env.MODE_DEMO_PASSWORD || "mode-demo-2026";
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

// ---------------------------------------------------------------------------
// v3 — membership plans, dues payments, ledger source references, outbox (#4)
// ---------------------------------------------------------------------------
export const PLAN_FREE_ID = "plan-associate";
export const PLAN_ANNUAL_ID = "plan-annual";

function addMembershipLifecycle(db: DatabaseSync, now: Date) {
  db.exec(`
    CREATE TABLE membership_plans (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      name TEXT NOT NULL,
      price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
      duration_days INTEGER NOT NULL CHECK (duration_days > 0),
      grants_member_pricing INTEGER NOT NULL CHECK (grants_member_pricing IN (0, 1)),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      purpose TEXT NOT NULL CHECK (purpose IN ('membership', 'ticket', 'order')),
      target_id TEXT NOT NULL,
      reference TEXT NOT NULL,
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      recorded_by TEXT REFERENCES members(id),
      recorded_at TEXT NOT NULL,
      UNIQUE (club_id, reference)
    );
    CREATE TABLE memberships (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      plan_id TEXT NOT NULL REFERENCES membership_plans(id),
      starts_on TEXT NOT NULL,
      expires_on TEXT NOT NULL CHECK (expires_on >= starts_on),
      payment_id TEXT REFERENCES payments(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX memberships_member_idx ON memberships (club_id, member_id, expires_on);
    ALTER TABLE transactions ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE transactions ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
    ALTER TABLE transactions ADD COLUMN source_type TEXT;
    ALTER TABLE transactions ADD COLUMN source_id TEXT;
    ALTER TABLE transactions ADD COLUMN event_id TEXT;
    ALTER TABLE transactions ADD COLUMN member_id TEXT;
    CREATE UNIQUE INDEX transactions_source_idx ON transactions (source_type, source_id) WHERE source_type IS NOT NULL;
    CREATE TABLE outbox_messages (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      kind TEXT NOT NULL,
      recipient_member_id TEXT REFERENCES members(id),
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      dedupe_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'previewed', 'sent', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );
    CREATE INDEX outbox_status_idx ON outbox_messages (club_id, status);
  `);
  const insertPlan = db.prepare("INSERT INTO membership_plans VALUES (?, ?, ?, ?, ?, ?, 1)");
  insertPlan.run(PLAN_FREE_ID, DEFAULT_CLUB_ID, "Free associate", 0, 365, 0);
  insertPlan.run(PLAN_ANNUAL_ID, DEFAULT_CLUB_ID, "Annual member", 50000, 365, 1);

  // Backfill the seeded paid starter members so their benefits follow the real rule.
  const paid = db.prepare("SELECT id, joined_at, expires_on FROM members WHERE dues_status = 'paid' AND expires_on IS NOT NULL").all();
  const insertMembership = db.prepare("INSERT INTO memberships VALUES (?, ?, ?, ?, ?, ?, NULL, ?)");
  for (const row of paid) {
    insertMembership.run(`seed-membership-${row.id}`, DEFAULT_CLUB_ID, row.id, PLAN_ANNUAL_ID, String(row.joined_at).slice(0, 10), row.expires_on, now.toISOString());
  }
  db.exec("UPDATE transactions SET category = CASE WHEN description LIKE '%membership%' THEN 'membership' WHEN description LIKE '%ticket%' THEN 'ticket' ELSE 'other' END");
}

// ---------------------------------------------------------------------------
// v4 — event bookings, tickets and check-ins (#5)
// ---------------------------------------------------------------------------
function addEventTicketing(db: DatabaseSync) {
  db.exec(`
    ALTER TABLE events ADD COLUMN club_id TEXT NOT NULL DEFAULT '${DEFAULT_CLUB_ID}';
    ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT '';
    ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'published'
      CHECK (status IN ('draft', 'published', 'cancelled'));
    ALTER TABLE events ADD COLUMN created_by TEXT;
    ALTER TABLE events ADD COLUMN created_at TEXT;
    CREATE TABLE bookings (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
      pricing TEXT NOT NULL CHECK (pricing IN ('member', 'guest')),
      status TEXT NOT NULL CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'expired')),
      payment_id TEXT REFERENCES payments(id),
      ticket_code TEXT UNIQUE,
      reserved_until TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX bookings_event_idx ON bookings (event_id, status);
    CREATE INDEX bookings_member_idx ON bookings (club_id, member_id);
    CREATE TABLE check_ins (
      booking_id TEXT PRIMARY KEY REFERENCES bookings(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      checked_in_by TEXT REFERENCES members(id),
      checked_in_at TEXT NOT NULL
    );
  `);
}

// ---------------------------------------------------------------------------
// v5 — product size variants and orders (#6)
// ---------------------------------------------------------------------------
function addMerchandiseOrders(db: DatabaseSync) {
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
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      variant_id TEXT NOT NULL REFERENCES product_variants(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
      total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
      pricing TEXT NOT NULL CHECK (pricing IN ('member', 'guest')),
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
      fulfilment TEXT NOT NULL CHECK (fulfilment IN ('unfulfilled', 'fulfilled')),
      payment_id TEXT REFERENCES payments(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX orders_member_idx ON orders (club_id, member_id);
    CREATE INDEX orders_status_idx ON orders (club_id, status, fulfilment);
  `);
  // Split the aggregate starter stock into size variants; totals stay 18 and 35.
  const insert = db.prepare("INSERT INTO product_variants VALUES (?, ?, ?, ?, ?)");
  for (const [size, stock] of [["S", 4], ["M", 6], ["L", 5], ["XL", 3]] as const) insert.run(`demo-product-1-${size}`, DEFAULT_CLUB_ID, "demo-product-1", size, stock);
  for (const [size, stock] of [["S", 8], ["M", 12], ["L", 10], ["XL", 5]] as const) insert.run(`demo-product-2-${size}`, DEFAULT_CLUB_ID, "demo-product-2", size, stock);
  db.exec("UPDATE products SET member_price_paise = CASE id WHEN 'demo-product-1' THEN 69900 WHEN 'demo-product-2' THEN 29900 ELSE member_price_paise END");
}

// ---------------------------------------------------------------------------
// v6 — receipts and the reimbursement workflow (#7)
// ---------------------------------------------------------------------------
function addTreasuryWorkflow(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE receipts (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      uploaded_by TEXT NOT NULL REFERENCES members(id),
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      sha256 TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE expense_requests (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      requested_by TEXT NOT NULL REFERENCES members(id),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      purpose TEXT NOT NULL,
      receipt_id TEXT UNIQUE REFERENCES receipts(id),
      receipt_reference TEXT,
      event_id TEXT REFERENCES events(id),
      status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')),
      reviewed_by TEXT REFERENCES members(id),
      reviewed_at TEXT,
      decision_note TEXT,
      paid_by TEXT REFERENCES members(id),
      paid_at TEXT,
      payment_reference TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX expense_requests_status_idx ON expense_requests (club_id, status);
    CREATE UNIQUE INDEX expense_requests_payment_idx ON expense_requests (club_id, payment_reference) WHERE payment_reference IS NOT NULL;
  `);
}

// ---------------------------------------------------------------------------
// v7 — announcement drafts, publication and delivery tracking (#8)
// ---------------------------------------------------------------------------
function addAnnouncementPublishing(db: DatabaseSync, now: Date) {
  // SQLite cannot relax NOT NULL on published_at, so rebuild the table with the same ids.
  db.exec(`
    CREATE TABLE announcements_v7 (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
      audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'active')),
      created_by TEXT REFERENCES members(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      CHECK (status = 'draft' OR published_at IS NOT NULL)
    );
    INSERT INTO announcements_v7 (id, club_id, title, body, status, audience, created_by, created_at, updated_at, published_at)
      SELECT id, '${DEFAULT_CLUB_ID}', title, body, 'published', 'all', NULL, published_at, published_at, published_at FROM announcements;
    DROP TABLE announcements;
    ALTER TABLE announcements_v7 RENAME TO announcements;
    CREATE INDEX announcements_published_idx ON announcements (club_id, status, published_at);
    ALTER TABLE outbox_messages ADD COLUMN reference_id TEXT;
    CREATE INDEX outbox_reference_idx ON outbox_messages (kind, reference_id);
  `);
  void now;
}

// ---------------------------------------------------------------------------
// v8 — volunteer task assignments, deadlines and progress (#9)
// ---------------------------------------------------------------------------
function addVolunteerTasks(db: DatabaseSync, now: Date) {
  db.exec(`
    CREATE TABLE tasks_v8 (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES clubs(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL DEFAULT '',
      assignee_id TEXT REFERENCES members(id),
      event_id TEXT REFERENCES events(id),
      due_at TEXT,
      status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
      created_by TEXT REFERENCES members(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    INSERT INTO tasks_v8 (id, club_id, title, description, assignee, assignee_id, event_id, due_at, status, created_by, created_at, updated_at, completed_at)
      SELECT t.id, '${DEFAULT_CLUB_ID}', t.title, '',
             CASE WHEN t.assignee = 'Unassigned' THEN '' ELSE t.assignee END,
             (SELECT m.id FROM members m WHERE m.name = t.assignee AND m.club_id = '${DEFAULT_CLUB_ID}' LIMIT 1),
             NULL, NULL, t.status, NULL, ?, ?, CASE WHEN t.status = 'done' THEN ? ELSE NULL END
      FROM tasks t;
  `.replace(/\?/g, `'${now.toISOString()}'`));
  db.exec(`
    DROP TABLE tasks;
    ALTER TABLE tasks_v8 RENAME TO tasks;
    CREATE INDEX tasks_assignee_idx ON tasks (club_id, assignee_id, status);
    CREATE INDEX tasks_event_idx ON tasks (club_id, event_id);
    CREATE INDEX tasks_due_idx ON tasks (club_id, status, due_at);
  `);
}
