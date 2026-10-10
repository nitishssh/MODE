import { MessageChannel, Worker, receiveMessageOnPort } from "node:worker_threads";
import type { Row, SqlDatabase, SqlStatement, SqlValue } from "./core";
import { MIGRATIONS_TABLE_DDL, POSTGRES_TO_SQLITE_ERRCODE, splitStatements, translateStatement } from "./postgres";

/**
 * Synchronous PostgreSQL driver with the `node:sqlite` surface the modules use.
 *
 * The domain modules are synchronous by design (one writer at a time, `BEGIN IMMEDIATE`
 * semantics). PostgreSQL drivers are asynchronous, so this adapter runs the `pg` client
 * in a worker thread and blocks the calling thread on each statement with `Atomics.wait`.
 * One connection, one statement in flight, strictly in program order: exactly the
 * concurrency model the SQLite code was written for, now on a PostgreSQL server.
 *
 * Every statement passes through `translateStatement()` (placeholders, PRAGMAs, DDL
 * types, rowid, INSERT OR IGNORE, …) and PostgreSQL errors are re-thrown with the SQLite
 * extended `errcode` so `isConstraintError()` keeps working unchanged.
 */

const WORKER_SOURCE = `
const { workerData } = require("node:worker_threads");
const { createRequire } = require("node:module");
const req = createRequire(workerData.cwd + "/package.json");
const pg = req("pg");
pg.types.setTypeParser(20, (value) => Number(value));   // int8    -> number (paise, counts)
pg.types.setTypeParser(1700, (value) => Number(value)); // numeric -> number (SUM of bigint)
const client = new pg.Client({ connectionString: workerData.url });
const port = workerData.port;
const signal = new Int32Array(workerData.signal);
const ready = client.connect();
ready.catch(() => {});
port.on("message", async (message) => {
  let reply;
  try {
    await ready;
    if (message.type === "close") {
      await client.end();
      reply = { ok: true, rows: [], rowCount: 0 };
    } else {
      const result = await client.query({ text: message.sql, values: message.params });
      const last = Array.isArray(result) ? result[result.length - 1] : result;
      reply = { ok: true, rows: last && last.rows ? last.rows : [], rowCount: last && last.rowCount ? last.rowCount : 0 };
    }
  } catch (error) {
    reply = { ok: false, message: String(error && error.message), code: error && error.code, detail: error && error.detail };
  }
  port.postMessage(reply);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
  if (message.type === "close") process.exit(0);
});
`;

interface Reply {
  ok: boolean;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  message?: string;
  code?: string;
  detail?: string;
}

export class PostgresError extends Error {
  code: string | undefined;
  detail: string | undefined;
  /** SQLite extended result code equivalent, so `isConstraintError()` works unchanged. */
  errcode?: number;
  constructor(reply: Reply, sql: string) {
    super(`${reply.message ?? "PostgreSQL error"}${reply.detail ? ` (${reply.detail})` : ""} — in: ${sql.slice(0, 160)}`);
    this.name = "PostgresError";
    this.code = reply.code;
    this.detail = reply.detail;
    const mapped = reply.code ? POSTGRES_TO_SQLITE_ERRCODE[reply.code] : undefined;
    if (mapped !== undefined) this.errcode = mapped;
    else if (reply.code?.startsWith("23")) this.errcode = 19; // SQLITE_CONSTRAINT, unspecific
  }
}

export function isPostgresUrl(target: string): boolean {
  return /^postgres(ql)?:\/\//i.test(target);
}

const REPLY_TIMEOUT_MS = 60_000;

function bindValue(value: SqlValue): unknown {
  if (value === undefined) return null; // defensive: callers are typed, JS callers may not be
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array && !Buffer.isBuffer(value)) return Buffer.from(value);
  return value;
}

export interface PostgresSyncOptions {
  /** Drop and recreate the `public` schema first. Tests only; destroys all data. */
  resetSchema?: boolean;
}

export function openPostgresSync(url: string, options: PostgresSyncOptions = {}): SqlDatabase {
  const { port1, port2 } = new MessageChannel();
  const shared = new SharedArrayBuffer(4);
  const signal = new Int32Array(shared);
  const worker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { url, cwd: process.cwd(), port: port2, signal: shared },
    transferList: [port2],
  });
  let workerFailure: Error | null = null;
  worker.on("error", (error) => { workerFailure = error; Atomics.store(signal, 0, 1); Atomics.notify(signal, 0); });
  worker.unref();
  let closed = false;

  function send(message: { type: "query" | "close"; sql: string; params: unknown[] }): Reply {
    if (closed) throw new Error("PostgreSQL connection is closed.");
    if (workerFailure) throw workerFailure;
    Atomics.store(signal, 0, 0);
    port1.postMessage(message);
    const deadline = Date.now() + REPLY_TIMEOUT_MS;
    while (Atomics.load(signal, 0) === 0) {
      if (Date.now() > deadline) throw new Error(`PostgreSQL did not answer within ${REPLY_TIMEOUT_MS / 1000}s. Is the \`pg\` package installed and ${url.replace(/\/\/[^@]*@/, "//***@")} reachable?`);
      Atomics.wait(signal, 0, 0, 1000);
    }
    if (workerFailure) throw workerFailure;
    const received = receiveMessageOnPort(port1);
    if (!received) throw new Error("PostgreSQL worker signalled without a reply.");
    return received.message as Reply;
  }

  function query(sql: string, params: unknown[] = []): { rows: Row[]; rowCount: number } {
    const reply = send({ type: "query", sql, params });
    if (!reply.ok) throw new PostgresError(reply, sql);
    return { rows: (reply.rows ?? []) as Row[], rowCount: reply.rowCount ?? 0 };
  }

  function prepare(sql: string): SqlStatement {
    const translated = translateStatement(sql);
    if (translated === null) {
      return { get: () => undefined, all: () => [], run: () => ({ changes: 0 }) };
    }
    return {
      get: (...params) => query(translated, params.map(bindValue)).rows[0],
      all: (...params) => query(translated, params.map(bindValue)).rows,
      run: (...params) => ({ changes: query(translated, params.map(bindValue)).rowCount }),
    };
  }

  function exec(sql: string): void {
    for (const statement of splitStatements(sql)) {
      const translated = translateStatement(statement);
      if (translated !== null) query(translated);
    }
  }

  function close(): void {
    if (closed) return;
    try { send({ type: "close", sql: "", params: [] }); } catch { /* worker already gone */ }
    closed = true;
    port1.close();
    void worker.terminate();
  }

  // Connection bootstrap: citext for case-insensitive email, schema_migrations as user_version.
  if (options.resetSchema) query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public");
  query("CREATE EXTENSION IF NOT EXISTS citext");
  query(MIGRATIONS_TABLE_DDL);

  return { prepare, exec, close, dialect: "postgres" };
}
