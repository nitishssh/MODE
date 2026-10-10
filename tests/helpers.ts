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

/** In-memory database with a controllable clock for domain-level tests. */
export function memoryDatabase(): { db: ClubDatabase; clock: { now: Date } } {
  const clock = { now: new Date(FIXED_NOW) };
  const db = openClubDatabase(":memory:", { now: () => new Date(clock.now) });
  return { db, clock };
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
  const priorNow = process.env.MODE_DEMO_NOW;
  process.env.SQLITE_PATH = join(directory, "mode.sqlite");
  process.env.MODE_DEMO_NOW = FIXED_NOW.toISOString();
  try {
    await fn();
  } finally {
    getDatabase().close();
    if (priorPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = priorPath;
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
