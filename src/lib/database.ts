import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Announcement,
  CreateMemberInput,
  Dashboard,
  Event,
  Member,
  Product,
  Task,
  Transaction,
} from "./contracts";
import { createMemberSchema } from "./member-validation";

const SCHEMA_VERSION = 1;

export class DuplicateMemberError extends Error {
  constructor() {
    super("A member with this email address already exists.");
    this.name = "DuplicateMemberError";
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

/** Local demo store. This file must only be imported by server code. */
export function openClubDatabase(
  filename: string,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());
  const path = filename === ":memory:" ? filename : resolve(filename);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");

  try {
    migrateAndSeed(db, now());
  } catch (error) {
    db.close();
    throw error;
  }

  function getMembers(): Member[] {
    return db
      .prepare("SELECT * FROM members ORDER BY joined_at DESC, name COLLATE NOCASE, id")
      .all()
      .map(mapMember);
  }

  function createMember(input: CreateMemberInput): Member {
    // Validate here as well so future server callers cannot bypass the API boundary.
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
      // The UNIQUE constraint provides the concurrency guarantee, including mixed-case email.
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
    const tasks: Task[] = db.prepare("SELECT * FROM tasks ORDER BY id").all().map((row) => ({
      id: String(row.id),
      title: String(row.title),
      assignee: String(row.assignee),
      status: row.status as Task["status"],
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
        name: "Sample Student Club",
        description: "Fictional demo data for the MODE student organization starter.",
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
    health: () => {
      db.prepare("SELECT 1").get();
      return { status: "ok" as const, database: "sqlite" as const, schemaVersion: SCHEMA_VERSION };
    },
    close: () => db.close(),
  };
}

export type ClubDatabase = ReturnType<typeof openClubDatabase>;

function migrateAndSeed(db: DatabaseSync, now: Date) {
  // Check inside the write transaction so simultaneous first requests cannot both seed.
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
      seedDemo(db, now);
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

  const insertEvent = db.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insertEvent.run("demo-event-1", "Welcome meetup", offset(7), "Sample campus · Room A", 60, 24, 5000, 10000);
  insertEvent.run("demo-event-2", "Community fundraiser", offset(14), "Sample campus · Courtyard", 100, 38, 10000, 15000);

  db.prepare("INSERT INTO announcements VALUES (?, ?, ?, ?)").run(
    "demo-announcement-1", "Welcome to the sample club", "These are fictional starter records. Add a member to try the working flow; other modules are previews for the team to build.", offset(-1),
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
