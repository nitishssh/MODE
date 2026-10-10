import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { transaction, type DbContext, type SqlDatabase } from "./db/core";
import { SCHEMA_VERSION, migrate } from "./db/migrations";
import { isPostgresUrl, openPostgresSync } from "./db/postgres-sync";
import { createWorkspaceModule } from "./modules/workspace";
import { createDashboardModule } from "./modules/dashboard";
import { createDuesModule } from "./modules/dues";
import { createAnnouncementsModule } from "./modules/announcements";
import { createEventsModule } from "./modules/events";
import { createIdentityModule } from "./modules/identity";
import { createMerchandiseModule } from "./modules/merchandise";
import { ledgerBalance, listLedger, postLedgerEntry, reconcileInventory, reconcileLedger, type LedgerEntryInput } from "./modules/ledger";

export { DuplicateMemberError } from "./errors";
export { SCHEMA_VERSION };

export type DatabaseKind = "sqlite" | "postgres";

/**
 * Open the club store. `target` is a SQLite path, `:memory:`, or a `postgres://` URL
 * (docs/POSTGRESQL.md). This file must only be imported by server code.
 */
export function openClubDatabase(target: string, options: { now?: () => Date; receiptsDir?: string; resetSchema?: boolean } = {}) {
  const now = options.now ?? (() => new Date());
  const kind: DatabaseKind = isPostgresUrl(target) ? "postgres" : "sqlite";
  let db: SqlDatabase;
  let path = target;
  if (kind === "postgres") {
    db = openPostgresSync(target, { resetSchema: options.resetSchema });
  } else {
    path = target === ":memory:" ? target : resolve(target);
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const sqlite = new DatabaseSync(path);
    sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    if (path !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL;");
    db = sqlite;
  }

  try {
    migrate(db, now());
  } catch (error) {
    db.close();
    throw error;
  }

  const ctx: DbContext = { db, now, depth: 0 };
  const identity = createIdentityModule(ctx);
  const dues = createDuesModule(ctx, identity);
  const events = createEventsModule(ctx, identity);
  const merchandise = createMerchandiseModule(ctx, identity);
  const dashboard = createDashboardModule(ctx, identity, { beforeRead: () => { events.releaseIfLapsed(); merchandise.releaseIfLapsed(); } });
  let closed = false;

  return {
    ...identity,
    ...dashboard,
    ...createWorkspaceModule(ctx, identity, options.receiptsDir ?? defaultReceiptsDir(kind, path)),
    dues,
    announcements: createAnnouncementsModule(ctx, identity),
    events,
    merchandise,
    ledger: {
      post: (input: LedgerEntryInput) => postLedgerEntry(ctx, input),
      list: (clubId: string) => listLedger(db, clubId),
      balance: (clubId: string) => ledgerBalance(db, clubId),
      reconcile: () => reconcileLedger(db),
      reconcileInventory: () => reconcileInventory(db),
    },
    /** Run `fn` atomically; financial modules post their ledger row inside it. */
    transaction: <T>(fn: () => T): T => transaction(ctx, fn),
    health: () => {
      db.prepare("SELECT 1").get();
      return { status: "ok" as const, database: kind, schemaVersion: SCHEMA_VERSION };
    },
    close: () => {
      if (closed) return;
      closed = true;
      db.close();
    },
    isClosed: () => closed,
  };
}

export type ClubDatabase = ReturnType<typeof openClubDatabase>;

/** SQLite: the `receipts` directory next to the database file. PostgreSQL: MODE_RECEIPTS_DIR or .data/receipts. */
function defaultReceiptsDir(kind: DatabaseKind, path: string): string {
  if (kind === "postgres") return resolve(process.env.MODE_RECEIPTS_DIR ?? ".data/receipts");
  return resolve(dirname(path === ":memory:" ? ".data/mode.sqlite" : path), "receipts");
}

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
  // DATABASE_URL (postgres://…) selects PostgreSQL; otherwise the SQLite file.
  const path = process.env.DATABASE_URL || process.env.SQLITE_PATH || ".data/mode.sqlite";
  if (!globalStore.modeDatabase || globalStore.modeDatabase.isClosed() || globalStore.modeDatabasePath !== path) {
    globalStore.modeDatabase?.close();
    globalStore.modeDatabase = openClubDatabase(path, { now: applicationClock });
    globalStore.modeDatabasePath = path;
  }
  return globalStore.modeDatabase;
}
