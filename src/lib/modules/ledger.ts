import { randomUUID } from "node:crypto";
import type { LedgerEntry } from "../contracts";
import { SQLITE_CONSTRAINT_UNIQUE, int, isConstraintError, nullableText, text, type DbContext, type Row, type SqlDatabase } from "../db/core";
import { ConflictError, ValidationError } from "../errors";

export interface LedgerEntryInput {
  /** Required: a ledger row never defaults to the sample club (audit #7). */
  clubId: string;
  eventId?: string | null;
  kind: "income" | "expense";
  /** Positive integer paise. */
  amountPaise: number;
  description: string;
  /** The record that moved the money. Each (type, id) may post exactly once. */
  source: { type: string; id: string };
  /** Officer who recorded it; null only for system entries such as opening balances. */
  recordedBy: string | null;
}

export function mapLedgerEntry(row: Row): LedgerEntry {
  return {
    id: text(row.id),
    description: text(row.description),
    kind: row.kind as LedgerEntry["kind"],
    amountPaise: int(row.amount_paise),
    occurredAt: text(row.occurred_at),
    sourceType: nullableText(row.source_type),
    sourceId: nullableText(row.source_id),
    recordedBy: nullableText(row.recorded_by),
  };
}

/**
 * Post one ledger row for a money-moving source (P0, #2). Must be called inside the
 * same transaction as the source's state change, so the two commit or fail together.
 */
export function postLedgerEntry(ctx: DbContext, input: LedgerEntryInput): LedgerEntry {
  if (ctx.depth === 0) throw new Error("postLedgerEntry must run inside the source's transaction.");
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new ValidationError("Ledger amounts must be positive integer paise.", [{ field: "amountPaise", message: "Must be a positive integer." }]);
  }
  if (!input.source.type || !input.source.id) throw new ValidationError("A ledger entry needs its source type and id.");
  if (!input.clubId) throw new ValidationError("A ledger entry needs its club.", [{ field: "clubId", message: "Required." }]);
  const id = randomUUID();
  try {
    ctx.db
      .prepare(
        "INSERT INTO transactions (id, description, kind, amount_paise, occurred_at, source_type, source_id, recorded_by, club_id, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, input.description, input.kind, input.amountPaise, ctx.now().toISOString(), input.source.type, input.source.id, input.recordedBy, input.clubId, input.eventId ?? null);
  } catch (error) {
    if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) {
      throw new ConflictError(`${input.source.type} ${input.source.id} has already been posted to the ledger.`, "duplicate_ledger_source");
    }
    throw error;
  }
  return mapLedgerEntry(ctx.db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Row);
}

/** Club-scoped (audit #16): there is no all-clubs ledger view. */
export function listLedger(db: SqlDatabase, clubId: string): LedgerEntry[] {
  if (!clubId) throw new ValidationError("A club is required to list the ledger.");
  return (db.prepare("SELECT * FROM transactions WHERE club_id = ? ORDER BY occurred_at DESC, rowid DESC").all(clubId) as Row[]).map(mapLedgerEntry);
}

export function ledgerBalance(db: SqlDatabase, clubId: string): number {
  if (!clubId) throw new ValidationError("A club is required to read the balance.");
  const row = db
    .prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE -amount_paise END), 0) AS balance FROM transactions WHERE club_id = ?")
    .get(clubId) as Row;
  return int(row.balance);
}

export interface InventoryReport {
  /** Events whose `registered` counter disagrees with live tickets plus the registrations seeded before the ticket table existed. */
  events: { eventId: string; registered: number; liveTickets: number; seeded: number; drift: number }[];
  /** Products whose aggregate stock disagrees with the sum of their sizes. */
  products: { productId: string; stock: number; variantTotal: number; drift: number }[];
}

/** Seat and stock counters are denormalised (audit #5); this is their twin of `reconcileLedger()`. Empty arrays mean clean. */
export function reconcileInventory(db: SqlDatabase): InventoryReport {
  const events = (db.prepare(`
    SELECT e.id, e.registered, e.seeded_registrations,
           (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status IN ('pending_payment', 'paid')) AS live
      FROM events e ORDER BY e.id`).all() as Row[])
    .map((row) => ({ eventId: text(row.id), registered: int(row.registered), liveTickets: int(row.live), seeded: int(row.seeded_registrations), drift: int(row.registered) - int(row.seeded_registrations) - int(row.live) }))
    .filter((row) => row.drift !== 0);
  const products = (db.prepare(`
    SELECT p.id, p.stock, COALESCE((SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id), 0) AS total
      FROM products p ORDER BY p.id`).all() as Row[])
    .map((row) => ({ productId: text(row.id), stock: int(row.stock), variantTotal: int(row.total), drift: int(row.stock) - int(row.total) }))
    .filter((row) => row.drift !== 0);
  return { events, products };
}

/** How a module proves a ledger row's source still exists. Modules register theirs here. */
export type SourceResolver = (db: SqlDatabase, sourceId: string) => boolean;

export const SOURCE_RESOLVERS: Record<string, SourceResolver> = {
  expense: (db, id) => db.prepare("SELECT 1 FROM expenses WHERE id = ? AND status = 'paid'").get(id) !== undefined,
  // Opening balances are their own source: the row documents a pre-system fact.
  opening_balance: (db, sourceId) => db.prepare("SELECT 1 FROM transactions WHERE id = ? AND source_type = 'opening_balance'").get(sourceId) !== undefined,
};

export interface ReconciliationReport {
  balancePaise: number;
  entries: number;
  openingBalances: number;
  /** Ledger rows whose source cannot be found by any registered resolver. */
  orphans: { id: string; sourceType: string | null; sourceId: string | null }[];
  /** (type, id) pairs that appear more than once; the UNIQUE index should make this empty. */
  duplicates: { sourceType: string; sourceId: string; count: number }[];
  /** Rows with no source at all; none are allowed after P0. */
  unsourced: number;
  /** Money-moving source records with no ledger row. Zero-value/free sources are excluded. */
  missing: { sourceType: string; sourceId: string }[];
  /** Existing rows whose value, direction, club or officer disagrees with the source. */
  mismatched: { sourceType: string; sourceId: string; fields: string[] }[];
}

/** The reconciliation harness (P0, #2). Every financial module extends SOURCE_RESOLVERS and asserts a clean report. */
export function reconcileLedger(db: SqlDatabase): ReconciliationReport {
  const rows = db.prepare("SELECT * FROM transactions").all() as Row[];
  const orphans: ReconciliationReport["orphans"] = [];
  let unsourced = 0;
  let openingBalances = 0;
  for (const row of rows) {
    const sourceType = nullableText(row.source_type);
    const sourceId = nullableText(row.source_id);
    if (!sourceType || !sourceId) {
      unsourced += 1;
      continue;
    }
    if (sourceType === "opening_balance") openingBalances += 1;
    const resolver = SOURCE_RESOLVERS[sourceType];
    if (!resolver || !resolver(db, sourceId)) orphans.push({ id: text(row.id), sourceType, sourceId });
  }
  const duplicates = (
    db
      .prepare("SELECT source_type, source_id, COUNT(*) AS n FROM transactions WHERE source_type IS NOT NULL GROUP BY source_type, source_id HAVING COUNT(*) > 1")
      .all() as Row[]
  ).map((row) => ({ sourceType: text(row.source_type), sourceId: text(row.source_id), count: int(row.n) }));
  // Walk the money sources as well as the ledger. A deleted/misvalued ledger row
  // cannot be detected by an existence resolver starting from that row.
  // Add new money-moving modules here alongside their SOURCE_RESOLVERS entry.
  const sources = db.prepare(`
    SELECT 'dues_payment' AS source_type, id AS source_id, amount_paise, 'income' AS kind, club_id, recorded_by
      FROM dues_payments
    UNION ALL
    SELECT 'ticket', id, price_paise, 'income', club_id, confirmed_by
      FROM tickets WHERE status = 'paid' AND price_paise > 0
    UNION ALL
    SELECT 'merch_order', id, total_paise, 'income', club_id, confirmed_by
      FROM merch_orders WHERE status IN ('paid', 'fulfilled') AND total_paise > 0
    UNION ALL
    SELECT 'expense', id, amount_paise, 'expense', club_id, NULL
      FROM expenses WHERE status = 'paid'
  `).all();
  const entriesBySource = new Map(rows.map(row => [JSON.stringify([row.source_type, row.source_id]), row]));
  const historicalUnknownPayers = new Set(db.prepare('SELECT transaction_id FROM legacy_ledger_imports WHERE unknown_payer = 1').all().map(row => text(row.transaction_id)));
  const missing: ReconciliationReport['missing'] = [];
  const mismatched: ReconciliationReport['mismatched'] = [];
  for (const source of sources) {
    const identity = { sourceType: text(source.source_type), sourceId: text(source.source_id) };
    const entry = entriesBySource.get(JSON.stringify([source.source_type, source.source_id]));
    if (!entry) { missing.push(identity); continue; }
    const fields: string[] = [];
    if (entry.amount_paise !== source.amount_paise) fields.push('amountPaise');
    if (entry.kind !== source.kind) fields.push('kind');
    if (entry.club_id !== source.club_id) fields.push('clubId');
    // Expenses may be reviewed and paid by different officers. The source stores
    // its reviewer, not its payer; require ledger attribution without conflating them.
    const knownHistoricalException = source.source_type === 'expense' && historicalUnknownPayers.has(text(entry.id));
    if ((entry.recorded_by === null && !knownHistoricalException) || (source.source_type !== 'expense' && entry.recorded_by !== source.recorded_by)) fields.push('recordedBy');
    if (fields.length) mismatched.push({ ...identity, fields });
  }
  const balance = db.prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE -amount_paise END), 0) AS balance FROM transactions").get() as Row;
  return { balancePaise: int(balance.balance), entries: rows.length, openingBalances, orphans, duplicates, unsourced, missing, mismatched };
}
