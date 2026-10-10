import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CursorPage } from "./contracts";
import { ValidationError } from "./errors";
import type { Actor } from "./modules/identity";
import type { SqlDatabase } from "./db/core";

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;

const id = z.string().trim().min(1).max(100).refine(value => !value.includes("\0"), "ID must not contain NUL.");
const booleanQuery = z.union([z.boolean(), z.enum(["true", "false"]).transform(value => value === "true")]);
const pageFields = {
  limit: z.preprocess(value => typeof value === "string" && /^[1-9]\d{0,2}$/.test(value) ? Number(value) : value,
    z.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT)),
  cursor: z.string().min(1).max(4096).optional(),
  q: z.string().trim().min(1).max(200).refine(value => !value.includes("\0"), "Search text must not contain NUL.").optional(),
};

export const membersPageSchema = z.object({
  ...pageFields, sort: z.literal("joinedAt_desc").default("joinedAt_desc"),
  role: z.enum(["member", "volunteer", "organizer", "treasurer", "admin"]).optional(),
  membership: z.enum(["active", "expired", "none"]).optional(),
}).strict();
export const tasksPageSchema = z.object({
  ...pageFields, sort: z.literal("createdAt_desc").default("createdAt_desc"),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: id.optional(), eventId: id.optional(),
  mine: booleanQuery.default(false), overdue: booleanQuery.default(false),
}).strict().refine(value => !value.mine || !value.assigneeId, {
  path: ["assigneeId"], message: "Use either mine or assigneeId.",
});
export const expensesPageSchema = z.object({
  ...pageFields, sort: z.literal("submittedAt_desc").default("submittedAt_desc"),
  status: z.enum(["submitted", "approved", "rejected", "paid"]).optional(),
  submitterId: id.optional(), eventId: id.optional(),
}).strict();
export const ledgerPageSchema = z.object({
  ...pageFields, sort: z.literal("occurredAt_desc").default("occurredAt_desc"),
  kind: z.enum(["income", "expense"]).optional(), eventId: id.optional(),
  category: z.enum(["membership", "events", "expense", "merch_order", "opening_balance"]).optional(),
}).strict();

/** Keep duplicates visible: silently selecting the first/last value is ambiguous. */
export function readPageQuery(request: Request): Record<string, string> {
  const input: Record<string, string> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(input, key)) throw new ValidationError("Query parameters must not be repeated.", [{ field: key, message: "Supply one value." }]);
    input[key] = value;
  }
  return input;
}

/** ASCII case-insensitive literal substring; Unicode code points retain their case. */
export function containsText(value: string): string {
  const folded = value.replace(/[A-Z]/g, character => character.toLowerCase());
  return `%${folded.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

/** Column names are static application SQL, never request input. */
export function containsTextPredicate(column: string, db: Pick<SqlDatabase, "dialect">): string {
  // SQLite lower() folds ASCII only. PostgreSQL lower()/ILIKE are locale-aware;
  // translate() gives both engines the same semantics, including citext columns.
  const folded = db.dialect === "postgres"
    ? `translate(CAST(${column} AS TEXT), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') COLLATE "C"`
    : `lower(${column})`;
  return `${folded} LIKE ? ESCAPE '\\'`;
}

const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  .refine(value => Number.isFinite(Date.parse(value)), "Invalid timestamp.");
const cursorSchema = z.object({
  v: z.literal(1), endpoint: z.enum(["members", "tasks", "expenses", "ledger"]),
  sort: z.string().max(40), scope: z.string().regex(/^[a-f0-9]{64}$/),
  asOf: timestamp, after: z.object({ timestamp, id }).strict(),
}).strict();
type Cursor = z.infer<typeof cursorSchema>;
export type PageContext = { limit: number; after: Cursor["after"] | null; asOf: string; encode: (after: Cursor["after"]) => string };

/**
 * The private, random server-side session id signs the cursor. It is never sent
 * in the payload. A cursor is bound to its endpoint, ordering, filters, club,
 * member, role and current login; SQL still independently enforces access.
 */
export function pageContext(
  actor: Actor, endpoint: Cursor["endpoint"],
  input: { limit: number; cursor?: string; sort: string; [key: string]: unknown }, now: Date,
): PageContext {
  const { limit, cursor, ...filters } = input;
  const scope = createHash("sha256").update(JSON.stringify({
    clubId: actor.clubId, memberId: actor.memberId, role: actor.role,
    filters: Object.fromEntries(Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))),
  })).digest("hex");
  const sign = (body: string) => createHmac("sha256", actor.sessionId).update(body).digest();
  let asOf = now.toISOString(), after: Cursor["after"] | null = null;
  if (cursor !== undefined) {
    try {
      const parts = cursor.split(".");
      if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("encoding");
      const [body, signature] = parts;
      const received = Buffer.from(signature, "base64url"), expected = sign(body);
      if (received.toString("base64url") !== signature || received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("signature");
      const bytes = Buffer.from(body, "base64url");
      if (bytes.toString("base64url") !== body) throw new Error("encoding");
      const decoded = cursorSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (decoded.endpoint !== endpoint || decoded.sort !== input.sort || decoded.scope !== scope) throw new Error("scope");
      asOf = decoded.asOf;
      after = decoded.after;
    } catch {
      throw new ValidationError("Invalid cursor for this list. Restart from the first page.", [{ field: "cursor", message: "Use the cursor from the same list, filters and login." }]);
    }
  }
  return { limit, after, asOf, encode: position => {
    const body = Buffer.from(JSON.stringify({ v: 1, endpoint, sort: input.sort, scope, asOf, after: position } satisfies Cursor)).toString("base64url");
    return `${body}.${sign(body).toString("base64url")}`;
  } };
}

/** Queries fetch limit + 1 authorized rows to detect whether another page exists. */
export function cursorPage<T>(rows: T[], context: PageContext, position: (row: T) => Cursor["after"]): CursorPage<T> {
  const hasMore = rows.length > context.limit;
  const items = rows.slice(0, context.limit);
  return { items, nextCursor: hasMore ? context.encode(position(items[items.length - 1])) : null, hasMore };
}
