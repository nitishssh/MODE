import { randomUUID } from "node:crypto";
import { SQLITE_CONSTRAINT_UNIQUE, isConstraintError, transaction, type DbContext } from "../db/core";
import { ConflictError, ValidationError } from "../errors";

export type LedgerCategory = "membership" | "ticket" | "merchandise" | "reimbursement" | "other";

export interface LedgerEntryInput {
  clubId: string;
  kind: "income" | "expense";
  category: LedgerCategory;
  amountPaise: number;
  description: string;
  /** Originating record; the pair is unique so a source can only ever post once. */
  source: { type: string; id: string };
  eventId?: string | null;
  memberId?: string | null;
}

/** Single club ledger. Every realized cash movement is one row that names its source exactly once. */
export function createLedgerModule(ctx: DbContext) {
  const { db } = ctx;

  function postEntry(input: LedgerEntryInput): string {
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
      throw new ValidationError("Ledger amounts must be positive integer paise.");
    }
    return transaction(ctx, () => {
      const id = randomUUID();
      try {
        db.prepare(
          `INSERT INTO transactions (id, description, kind, amount_paise, occurred_at, club_id, category, source_type, source_id, event_id, member_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.description,
          input.kind,
          input.amountPaise,
          ctx.now().toISOString(),
          input.clubId,
          input.category,
          input.source.type,
          input.source.id,
          input.eventId ?? null,
          input.memberId ?? null,
        );
      } catch (error) {
        if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) {
          throw new ConflictError("This transaction has already been recorded in the ledger.", "duplicate_ledger_source");
        }
        throw error;
      }
      return id;
    });
  }

  function hasEntryFor(source: { type: string; id: string }): boolean {
    return db.prepare("SELECT 1 FROM transactions WHERE source_type = ? AND source_id = ?").get(source.type, source.id) !== undefined;
  }

  return { postEntry, hasEntryFor };
}

export type LedgerModule = ReturnType<typeof createLedgerModule>;
