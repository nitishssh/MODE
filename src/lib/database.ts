import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DbContext } from "./db/core";
import { SCHEMA_VERSION, migrate } from "./db/migrations";
import { createDashboardModule } from "./modules/dashboard";
import { createEventsModule } from "./modules/events";
import { createIdentityModule } from "./modules/identity";
import { createLedgerModule } from "./modules/ledger";
import { createMembershipModule } from "./modules/membership";
import { createMerchandiseModule } from "./modules/merchandise";
import { createOutboxModule } from "./modules/outbox";

export { DuplicateMemberError } from "./errors";
export { SCHEMA_VERSION };

/** Local store. This file must only be imported by server code. */
export function openClubDatabase(filename: string, options: { now?: () => Date } = {}) {
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
  const ledger = createLedgerModule(ctx);
  const outbox = createOutboxModule(ctx);
  const membership = createMembershipModule(ctx, identity, ledger, outbox);
  const events = createEventsModule(ctx, identity, membership, ledger);
  const merchandise = createMerchandiseModule(ctx, identity, membership, ledger);
  let closed = false;

  return {
    ...identity,
    ...dashboard,
    ledger,
    outbox,
    membership,
    events,
    merchandise,
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
