import type { DatabaseSync } from "node:sqlite";

export type Row = Record<string, string | number | bigint | Uint8Array | null>;

/** Shared state handed to every domain module. */
export interface DbContext {
  db: DatabaseSync;
  now: () => Date;
  /** Transaction nesting depth; inner calls become savepoints. */
  depth: number;
}

/**
 * Run `fn` atomically. The outermost call takes a write lock immediately so
 * capacity/stock checks and their updates cannot interleave with another writer.
 */
export function transaction<T>(ctx: DbContext, fn: () => T): T {
  const { db } = ctx;
  const savepoint = `sp_${ctx.depth}`;
  if (ctx.depth === 0) db.exec("BEGIN IMMEDIATE");
  else db.exec(`SAVEPOINT ${savepoint}`);
  ctx.depth += 1;
  try {
    const result = fn();
    ctx.depth -= 1;
    if (ctx.depth === 0) db.exec("COMMIT");
    else db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    ctx.depth -= 1;
    if (ctx.depth === 0) db.exec("ROLLBACK");
    else db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`);
    throw error;
  }
}

export const SQLITE_CONSTRAINT_CHECK = 275;
export const SQLITE_CONSTRAINT_FOREIGNKEY = 787;
export const SQLITE_CONSTRAINT_UNIQUE = 2067;

export function isConstraintError(error: unknown, code?: number): boolean {
  if (!(error instanceof Error) || !("errcode" in error)) return false;
  const errcode = Number((error as { errcode: unknown }).errcode);
  // 19 = SQLITE_CONSTRAINT; extended codes keep the base code in the low byte.
  return code === undefined ? (errcode & 0xff) === 19 : errcode === code;
}

export const text = (value: Row[string]): string => String(value);
export const int = (value: Row[string]): number => Number(value);
export const nullableText = (value: Row[string]): string | null => (value === null ? null : String(value));

/** Club calendar day. The club operates in Asia/Kolkata (UTC+05:30). */
export const CLUB_UTC_OFFSET_MINUTES = 330;
export function clubDate(at: Date): string {
  return new Date(at.getTime() + CLUB_UTC_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}
export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}
