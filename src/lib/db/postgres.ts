import type { DatabaseSync } from "node:sqlite";

/**
 * PostgreSQL integration, dependency-free.
 *
 * The application runs on `node:sqlite` (synchronous, one writable process). This module
 * is the bridge to PostgreSQL that needs no npm driver:
 *
 *   - `postgresSchema(db)`   translates the live SQLite schema into PostgreSQL DDL
 *                            (docs/schema.postgres.sql, verified by `npm run check`);
 *   - `postgresExport(db)`   produces a complete, transactional SQL script (DDL + data)
 *                            that `psql -f` loads into an empty PostgreSQL database;
 *   - `toPostgresPlaceholders`, `PG_*` error codes and `SQLITE_TO_POSTGRES_ERRCODE`
 *                            are the pieces a future async `pg` adapter will reuse.
 *
 * See docs/POSTGRESQL.md for the mapping rules and the runtime migration plan.
 */

// ---------------------------------------------------------------------------
// Error codes. SQLite extended result codes <-> PostgreSQL SQLSTATE classes.
// ---------------------------------------------------------------------------
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_NOT_NULL_VIOLATION = "23502";
export const PG_SERIALIZATION_FAILURE = "40001";
export const PG_DEADLOCK_DETECTED = "40P01";

/** `isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)` in core.ts maps to these SQLSTATEs. */
export const SQLITE_TO_POSTGRES_ERRCODE: Record<number, string> = {
  2067: PG_UNIQUE_VIOLATION, // SQLITE_CONSTRAINT_UNIQUE
  275: PG_CHECK_VIOLATION, // SQLITE_CONSTRAINT_CHECK
  787: PG_FOREIGN_KEY_VIOLATION, // SQLITE_CONSTRAINT_FOREIGNKEY
  1299: PG_NOT_NULL_VIOLATION, // SQLITE_CONSTRAINT_NOTNULL
};

/** Shape of a `pg` DatabaseError; only `code` is needed here. */
export function isPostgresConstraintError(error: unknown, code?: string): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false;
  const sqlstate = String((error as { code: unknown }).code);
  return code === undefined ? sqlstate.startsWith("23") : sqlstate === code;
}

// ---------------------------------------------------------------------------
// SQL text helpers
// ---------------------------------------------------------------------------

/** Rewrite `?` positional placeholders to `$1..$n`, leaving `?` inside string literals alone. */
export function toPostgresPlaceholders(sql: string): string {
  let out = "";
  let index = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      inString = !inString;
      out += ch;
    } else if (ch === "?" && !inString) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return out;
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** PostgreSQL literal for a SQLite value (standard_conforming_strings = on). */
export function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Uint8Array) return `'\\x${Buffer.from(value).toString("hex")}'::bytea`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Schema translation
// ---------------------------------------------------------------------------
export interface SchemaObject {
  type: "table" | "index";
  name: string;
  tableName: string;
  sql: string;
}

export function readSchemaObjects(db: DatabaseSync): SchemaObject[] {
  const rows = db
    .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table', 'index') ORDER BY name")
    .all() as Array<{ type: string; name: string; tbl_name: string; sql: string }>;
  return rows.map((row) => ({ type: row.type as SchemaObject["type"], name: row.name, tableName: row.tbl_name, sql: row.sql.trim() }));
}

/** Tables a CREATE TABLE statement references (foreign keys), excluding itself. */
export function referencedTables(sql: string, self: string): string[] {
  const found = new Set<string>();
  for (const match of sql.matchAll(/\bREFERENCES\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/g)) {
    if (match[1] !== self) found.add(match[1]);
  }
  return [...found];
}

/** Parents before children so PostgreSQL can create foreign keys inline; alphabetical tie-break. */
export function orderTablesByDependency(tables: SchemaObject[]): SchemaObject[] {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const remaining = new Map(tables.map((t) => [t.name, referencedTables(t.sql, t.name).filter((d) => byName.has(d))]));
  const ordered: SchemaObject[] = [];
  while (remaining.size) {
    const ready = [...remaining.entries()].filter(([, deps]) => deps.every((d) => !remaining.has(d))).map(([name]) => name).sort();
    if (!ready.length) throw new Error(`Circular foreign keys between: ${[...remaining.keys()].join(", ")}`);
    for (const name of ready) {
      ordered.push(byName.get(name)!);
      remaining.delete(name);
    }
  }
  return ordered;
}

/**
 * SQLite CREATE TABLE -> PostgreSQL CREATE TABLE.
 *   INTEGER            -> bigint (paise never overflow; booleans stay 0/1 with their CHECKs)
 *   TEXT COLLATE NOCASE-> citext (case-insensitive uniqueness, same semantics for ASCII)
 *   (a IS NULL)+(b IS NULL) -> explicit ::int casts (PostgreSQL has no boolean arithmetic)
 *   + seq bigint identity column, the explicit twin of SQLite's implicit rowid
 */
export function translateTableDdl(sql: string): string {
  let out = sql.replace(/\s+$/, "");
  if (out.endsWith(";")) out = out.slice(0, -1);
  out = out.replace(/\bTEXT\b([^,()]*?)\s+COLLATE\s+NOCASE/gi, "citext$1");
  out = out.replace(/\bINTEGER\b/g, "bigint");
  out = out.replace(/\(\s*(\w+)\s+IS\s+NULL\s*\)\s*\+\s*\(\s*(\w+)\s+IS\s+NULL\s*\)/g, "(($1 IS NULL)::int + ($2 IS NULL)::int)");
  const close = out.lastIndexOf(")");
  if (close === -1) throw new Error(`Cannot translate table DDL: ${sql.slice(0, 60)}`);
  out = `${out.slice(0, close).replace(/\s+$/, "")},\n      seq bigint GENERATED BY DEFAULT AS IDENTITY\n    )`;
  return `${out};`;
}

export function translateIndexDdl(sql: string): string {
  let out = sql.replace(/\s+$/, "");
  if (out.endsWith(";")) out = out.slice(0, -1);
  return `${out.replace(/\bCOLLATE\s+NOCASE\b/gi, "")};`;
}

export interface PostgresScriptOptions {
  /** Schema version recorded in schema_migrations. */
  version: number;
  /** Emit DROP TABLE IF EXISTS ... CASCADE first so the script can be re-run. */
  replace?: boolean;
  /** Rows per INSERT statement. */
  batchSize?: number;
  /** Tables whose rows are not exported (DDL still is). */
  skipData?: string[];
  /** Replaces the generated timestamp line; keeps docs/schema.postgres.sql deterministic. */
  generatedAt?: string;
}

const MIGRATIONS_TABLE = "schema_migrations";

function ddlStatements(db: DatabaseSync, options: PostgresScriptOptions): { tables: SchemaObject[]; lines: string[] } {
  const objects = readSchemaObjects(db);
  const tables = orderTablesByDependency(objects.filter((o) => o.type === "table"));
  const indexes = objects.filter((o) => o.type === "index");
  const lines: string[] = ["CREATE EXTENSION IF NOT EXISTS citext;", ""];
  if (options.replace) {
    lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(MIGRATIONS_TABLE)} CASCADE;`);
    for (const table of [...tables].reverse()) lines.push(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)} CASCADE;`);
    lines.push("");
  }
  for (const table of tables) {
    lines.push(`-- ${"─".repeat(70)}`, `-- ${table.name}`, `-- ${"─".repeat(70)}`, translateTableDdl(table.sql));
    for (const index of indexes.filter((i) => i.tableName === table.name).sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(translateIndexDdl(index.sql));
    }
    lines.push("");
  }
  lines.push(
    `-- ${"─".repeat(70)}`,
    `-- ${MIGRATIONS_TABLE} (PostgreSQL twin of PRAGMA user_version)`,
    `-- ${"─".repeat(70)}`,
    `CREATE TABLE ${quoteIdentifier(MIGRATIONS_TABLE)} (`,
    "      version bigint PRIMARY KEY,",
    "      applied_at timestamptz NOT NULL DEFAULT now()",
    "    );",
    `INSERT INTO ${quoteIdentifier(MIGRATIONS_TABLE)} (version) VALUES (${options.version});`,
    "",
  );
  return { tables, lines };
}

/** PostgreSQL DDL only, deterministic, for docs/schema.postgres.sql. */
export function postgresSchema(db: DatabaseSync, version: number): string {
  const { lines } = ddlStatements(db, { version });
  return [
    "-- MODE database schema (PostgreSQL translation)",
    `-- Generated by scripts/dump-schema.ts from src/lib/db/migrations.ts at schema version ${version}.`,
    "-- Do not edit by hand: run `npm run schema:dump` after adding a migration.",
    "-- Translation rules: INTEGER -> bigint, TEXT COLLATE NOCASE -> citext, boolean arithmetic in",
    "-- CHECKs -> ::int casts, plus an explicit `seq` identity column standing in for SQLite's rowid.",
    "-- Seed rows are not included; `npm run postgres:export` writes schema and data together.",
    "",
    ...lines,
  ].join("\n");
}

/** Complete load script: schema, data in dependency order, identity sequences, one transaction. */
export function postgresExport(db: DatabaseSync, options: PostgresScriptOptions): string {
  const batchSize = options.batchSize ?? 200;
  const skip = new Set(options.skipData ?? []);
  const { tables, lines: ddl } = ddlStatements(db, options);
  const lines: string[] = [
    "-- MODE PostgreSQL export: schema and data from the SQLite database.",
    `-- Schema version ${options.version}. Generated ${options.generatedAt ?? new Date().toISOString()}.`,
    "-- Load into an empty database:  psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f <this file>",
    "",
    "BEGIN;",
    "SET standard_conforming_strings = on;",
    "SET client_min_messages = warning;",
    "",
    ...ddl,
  ];
  let total = 0;
  const sequences: string[] = [];
  for (const table of tables) {
    if (skip.has(table.name)) {
      lines.push(`-- ${table.name}: data skipped on request`, "");
      continue;
    }
    const columns = (db.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`).all() as Array<{ name: string }>).map((c) => c.name);
    const rows = db.prepare(`SELECT rowid AS __seq, * FROM ${quoteIdentifier(table.name)} ORDER BY rowid`).all() as Array<Record<string, unknown>>;
    lines.push(`-- ${table.name}: ${rows.length} row(s)`);
    const columnList = [...columns, "seq"].map(quoteIdentifier).join(", ");
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const tuples = batch.map((row) => `  (${[...columns.map((c) => quoteLiteral(row[c])), quoteLiteral(row.__seq)].join(", ")})`);
      lines.push(`INSERT INTO ${quoteIdentifier(table.name)} (${columnList}) VALUES`, `${tuples.join(",\n")};`);
    }
    if (rows.length) sequences.push(table.name);
    lines.push("");
    total += rows.length;
  }
  if (sequences.length) {
    // Identity sequences continue after the highest imported seq; PERFORM keeps psql output quiet.
    lines.push("-- identity sequences", "DO $$ BEGIN");
    for (const name of sequences) {
      lines.push(`  PERFORM setval(pg_get_serial_sequence('${quoteIdentifier(name)}', 'seq'), (SELECT MAX(seq) FROM ${quoteIdentifier(name)}));`);
    }
    lines.push("END $$;", "");
  }
  lines.push(`-- ${total} row(s) across ${tables.length} table(s).`, "COMMIT;", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Runtime dialect translation: the SQL the modules write (SQLite) -> PostgreSQL.
// Used by openPostgresSync() for every statement the application executes.
// ---------------------------------------------------------------------------

/** PostgreSQL SQLSTATE -> the SQLite extended code `isConstraintError()` expects. */
export const POSTGRES_TO_SQLITE_ERRCODE: Record<string, number> = Object.fromEntries(
  Object.entries(SQLITE_TO_POSTGRES_ERRCODE).map(([sqlite, pg]) => [pg, Number(sqlite)]),
);

/** Split a multi-statement script on `;` outside string literals; drops empty statements. */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inString = false;
  for (const ch of sql) {
    if (ch === "'") inString = !inString;
    if (ch === ";" && !inString) {
      if (current.trim()) out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (version bigint PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;

/**
 * Translate one statement. Returns null for statements PostgreSQL does not need
 * (SQLite PRAGMAs that configure the connection).
 */
export function translateStatement(sql: string): string | null {
  let s = sql.trim().replace(/;$/, "");
  const upper = s.toUpperCase();

  // --- PRAGMAs -------------------------------------------------------------
  const pragma = /^PRAGMA\s+(\w+)(?:\s*=\s*(.+)|\s*\((\w+)\))?$/i.exec(s);
  if (pragma) {
    const [, name, assigned, arg] = pragma;
    if (name.toLowerCase() === "user_version") {
      if (assigned !== undefined) return `INSERT INTO "${MIGRATIONS_TABLE}" (version) VALUES (${Number(assigned)}) ON CONFLICT (version) DO NOTHING`;
      return `SELECT COALESCE(MAX(version), 0)::int AS user_version FROM "${MIGRATIONS_TABLE}"`;
    }
    if (name.toLowerCase() === "table_info" && arg) {
      return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${arg.replace(/"/g, "")}' ORDER BY ordinal_position`;
    }
    return null; // foreign_keys, busy_timeout, journal_mode: connection settings SQLite needs, PostgreSQL does not
  }

  // --- transactions --------------------------------------------------------
  if (upper === "BEGIN IMMEDIATE" || upper === "BEGIN") return "BEGIN";

  // --- DDL -----------------------------------------------------------------
  if (/^CREATE\s+TABLE\b/i.test(s)) return translateTableDdl(s).replace(/;$/, "");
  if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(s)) return translateIndexDdl(s).replace(/;$/, "");
  if (/^ALTER\s+TABLE\b/i.test(s)) {
    return s.replace(/\bINTEGER\b/g, "bigint").replace(/\bTEXT\b([^,()]*?)\s+COLLATE\s+NOCASE/gi, "citext$1");
  }

  // --- catalog -------------------------------------------------------------
  s = s.replace(/FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s*=\s*\?/i,
    "FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?");

  // --- DML / query dialect -------------------------------------------------
  s = s.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
  if (/^INSERT INTO\b/i.test(s) && /\bINSERT\s+OR\s+IGNORE\b/i.test(sql)) s += " ON CONFLICT DO NOTHING";
  s = s.replace(/\bMAX\(\s*0\s*,/gi, "GREATEST(0,");
  s = s.replace(/\browid\b/gi, "seq");
  s = s.replace(/(\w+(?:\.\w+)?)\s+COLLATE\s+NOCASE\b/gi, "LOWER($1)");
  s = s.replace(/\bAS\s+'([^']+)'/gi, 'AS "$1"');
  s = s.replace(/\bIS\s+\?/gi, "IS NOT DISTINCT FROM ?");
  return toPostgresPlaceholders(s);
}
