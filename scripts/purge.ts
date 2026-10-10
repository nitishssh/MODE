import { openClubDatabase } from "../src/lib/database";

/**
 * Maintenance: delete expired/revoked sessions, stale login counters and simulated outbox
 * rows older than the retention window, then report inventory and ledger drift.
 *
 *   npm run db:purge            (DATABASE_URL or SQLITE_PATH selects the database)
 */
const target = process.env.DATABASE_URL || process.env.SQLITE_PATH || ".data/mode.sqlite";
const db = openClubDatabase(target);
try {
  const purged = db.purge();
  const inventory = db.ledger.reconcileInventory();
  const ledger = db.ledger.reconcile();
  console.log(`Purged ${purged.sessions} session(s), ${purged.loginAttempts} login counter(s), ${purged.outbox} outbox row(s).`);
  console.log(`Inventory drift: ${inventory.events.length} event(s), ${inventory.products.length} product(s).`);
  console.log(`Ledger: ${ledger.entries} entries, ${ledger.orphans.length} orphan(s), ${ledger.missing.length} missing, ${ledger.mismatched.length} mismatched.`);
  if (inventory.events.length || inventory.products.length) console.log(JSON.stringify(inventory, null, 2));
} finally {
  db.close();
}
