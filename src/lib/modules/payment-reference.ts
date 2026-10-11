import type { DbContext } from "../db/core";
import { ConflictError } from "../errors";

/** One external transfer cannot fund different revenue sources in the same club. */
export function lockPaymentReferences(ctx: DbContext, clubId: string): void {
  if (ctx.depth === 0) throw new Error("Payment references must be checked inside a transaction.");
  // SQLite already holds BEGIN IMMEDIATE. PostgreSQL needs a shared row lock
  // before querying different source tables, including when no reference exists yet.
  if (ctx.db.dialect === "postgres") {
    ctx.db.prepare("UPDATE clubs SET id = id WHERE id = ?").run(clubId);
  }
}

export function assertPaymentReferenceAvailable(ctx: DbContext, clubId: string, reference: string): void {
  lockPaymentReferences(ctx, clubId);
  const match = ctx.db.prepare(`
    SELECT id FROM dues_payments WHERE club_id = ? AND reference = ?
    UNION ALL SELECT id FROM tickets WHERE club_id = ? AND payment_reference = ?
    UNION ALL SELECT id FROM merch_orders WHERE club_id = ? AND payment_reference = ?
  `).get(clubId, reference, clubId, reference, clubId, reference);
  if (match) throw new ConflictError("This external payment reference is already recorded. Use a different transfer reference.", "payment_reference_reused");
}
