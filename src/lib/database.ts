import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { transaction, type DbContext } from "./db/core";
import { SCHEMA_VERSION, migrate } from "./db/migrations";
import { createWorkspaceModule } from "./modules/workspace";
import { createDashboardModule } from "./modules/dashboard";
import { createDuesModule } from "./modules/dues";
import { createAnnouncementsModule } from "./modules/announcements";
import { createEventsModule } from "./modules/events";
import { createIdentityModule } from "./modules/identity";
import { createMerchandiseModule } from "./modules/merchandise";
import { ledgerBalance, listLedger, postLedgerEntry, reconcileLedger, type LedgerEntryInput } from "./modules/ledger";

export { DuplicateMemberError } from "./errors";
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
  const dues = createDuesModule(ctx, identity);
  const events = createEventsModule(ctx, identity);
  const merchandise = createMerchandiseModule(ctx, identity);
  let closed = false;

  return {
    ...identity,
    ...dashboard,
    ...createWorkspaceModule(ctx, identity, options.receiptsDir ?? resolve(dirname(path === ":memory:" ? ".data/mode.sqlite" : path), "receipts")),
    dues,
    announcements: createAnnouncementsModule(ctx, identity),
    events,
    merchandise,
    ledger: {
      post: (input: LedgerEntryInput) => postLedgerEntry(ctx, input),
      list: () => listLedger(db),
      balance: () => ledgerBalance(db),
      reconcile: () => reconcileLedger(db),
    },
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
