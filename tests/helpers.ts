import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE } from "../src/lib/auth/session";
import { getDatabase, openClubDatabase, type ClubDatabase } from "../src/lib/database";
import { demoPassword } from "../src/lib/db/migrations";
import type { Actor } from "../src/lib/modules/identity";

export const ORIGIN = "http://localhost:3000";
export const FIXED_NOW = new Date("2026-10-10T08:00:00.000Z");

/** Demo officer accounts seeded by schema v2. */
export const DEMO = {
  admin: "lead@example.com",
  organizer: "organizer@example.com",
  treasurer: "treasurer@example.com",
  volunteer: "volunteer@example.com",
  member: "asha@example.com",
} as const;

/**
 * Set MODE_TEST_DATABASE_URL=postgres://… to run the helper-based tests against PostgreSQL
 * (the schema is dropped and recreated for every database the helpers open).
 */
export const TEST_DATABASE_URL = process.env.MODE_TEST_DATABASE_URL;

/** In-memory database (or a reset PostgreSQL schema) with a controllable clock for domain-level tests. */
export function memoryDatabase(): { db: ClubDatabase; clock: { now: Date } } {
  const clock = { now: new Date(FIXED_NOW) };
  const receiptsDir = mkdtempSync(join(tmpdir(), "mode-memory-receipts-"));
  const db = openClubDatabase(TEST_DATABASE_URL ?? ":memory:", { now: () => new Date(clock.now), receiptsDir, resetSchema: Boolean(TEST_DATABASE_URL) });
  const close = db.close;
  db.close = () => { close(); rmSync(receiptsDir, { recursive: true, force: true }); };
  return { db, clock };
}

/** Small synthetic attachment through the same domain path used by uploads. */
export function receiptFor(db: ClubDatabase, actor: Actor): string {
  const data = Buffer.from("%PDF-1.4 synthetic test receipt");
  return db.saveReceipt(actor, { filename: "test.pdf", mimeType: "application/pdf", sizeBytes: data.length, data }).id;
}

/** Signed-in actor for a seeded account (officers) or a member given credentials. */
export function actorFor(db: ClubDatabase, email: string, password = demoPassword()): Actor {
  const actor = db.getActor(db.login({ email, password }).token);
  if (!actor) throw new Error(`No session for ${email}`);
  return actor;
}

/** Route-level tests share the process-wide database; point it at a temp file. */
export async function withRouteDatabase(fn: () => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "mode-route-test-"));
  const priorPath = process.env.SQLITE_PATH;
  const priorUrl = process.env.DATABASE_URL;
  const priorNow = process.env.MODE_DEMO_NOW;
  process.env.SQLITE_PATH = join(directory, "mode.sqlite");
  process.env.MODE_DEMO_NOW = FIXED_NOW.toISOString();
  if (TEST_DATABASE_URL) {
    openClubDatabase(TEST_DATABASE_URL, { resetSchema: true }).close(); // wipe, then let getDatabase() reopen
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.MODE_RECEIPTS_DIR = join(directory, "receipts");
  } else delete process.env.DATABASE_URL;
  try {
    await fn();
  } finally {
    getDatabase().close();
    if (priorPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = priorPath;
    if (priorUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorUrl;
    delete process.env.MODE_RECEIPTS_DIR;
    if (priorNow === undefined) delete process.env.MODE_DEMO_NOW;
    else process.env.MODE_DEMO_NOW = priorNow;
    rmSync(directory, { recursive: true, force: true });
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  origin?: string | null;
  rawBody?: string;
  authorization?: string;
}

export function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers.Origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.authorization !== undefined) headers.Authorization = options.authorization;
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, { method: options.method ?? (body === undefined ? "GET" : "POST"), headers, body });
}

/** Cookie header value for a seeded account, obtained through the real login route. */
export async function loginCookie(email: string, password = demoPassword()): Promise<string> {
  const { POST } = await import("../src/app/api/auth/login/route");
  const response = await POST(apiRequest("/api/auth/login", { body: { email, password } }));
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  return cookieFrom(response);
}

export function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  if (!match) throw new Error("Response did not set a session cookie.");
  return `${SESSION_COOKIE}=${match[1]}`;
}

export const routeParams = <P>(params: P) => ({ params: Promise.resolve(params) });
