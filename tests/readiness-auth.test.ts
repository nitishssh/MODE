import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as me } from "../src/app/api/auth/me/route";
import { DEMO_MEMBERS, DEMO_OFFICERS, demoPassword } from "../src/lib/db/migrations";
import { openClubDatabase } from "../src/lib/database";
import { UnauthorizedError } from "../src/lib/errors";
import { assertSameOrigin } from "../src/lib/mutation-guard";
import { sessionCookie } from "../src/lib/auth/session";
import { DEMO, memoryDatabase, withRouteDatabase } from "./helpers";

function environment(t: TestContext, values: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test("configured public HTTPS origin supports login and cookie logout through an HTTP proxy", async t => {
  environment(t, { MODE_PUBLIC_ORIGIN: "https://club.example" });
  await withRouteDatabase(async () => {
    const request = (path: string, init: RequestInit = {}) => new Request("http://internal:3000" + path, {
      ...init, headers: { Host: "internal:3000", Origin: "https://club.example", ...init.headers },
    });
    const signedIn = await login(request("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO.organizer, password: demoPassword() }),
    }));
    assert.equal(signedIn.status, 200);
    const header = signedIn.headers.get("set-cookie")!;
    assert.match(header, /; Secure/);
    const cookie = header.split(";")[0];
    assert.equal((await me(request("/api/auth/me", { headers: { Cookie: cookie } }))).status, 200);
    const rejected = await logout(request("/api/auth/logout", { method: "POST", headers: { Cookie: cookie, Origin: "https://foreign.example" } }));
    assert.equal(rejected.status, 403);
    assert.equal((await logout(request("/api/auth/logout", { method: "POST", headers: { Cookie: cookie } }))).status, 200);
    assert.equal((await me(request("/api/auth/me", { headers: { Cookie: cookie } }))).status, 401);
  });
});

test("a configured public origin rejects spoofed forwarding, scheme/port changes and cross-site writes", t => {
  environment(t, { MODE_PUBLIC_ORIGIN: "https://club.example" });
  for (const origin of ["https://foreign.example", "http://club.example", "https://club.example:444", "null"]) {
    assert.throws(() => assertSameOrigin(new Request("http://internal:3000/api/auth/login", {
      method: "POST", headers: { Origin: origin, Host: "foreign.example", "X-Forwarded-Host": "foreign.example", "X-Forwarded-Proto": "https" },
    })), /Cross-origin/);
  }
  assert.throws(() => assertSameOrigin(new Request("http://internal:3000/api/auth/login", {
    method: "POST", headers: { Origin: "https://club.example", "Sec-Fetch-Site": "cross-site" },
  })), /Cross-origin/);
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://internal:3000/api/auth/login", { method: "POST" })));
});

test("invalid public-origin configuration fails closed for writes and cookies", t => {
  environment(t, { MODE_PUBLIC_ORIGIN: undefined });
  for (const origin of ["https://user:pass@club.example", "https://club.example/path", "https://club.example/", "https://club.example?q=1", "https://club.example#fragment", "ftp://club.example", "*", "null"]) {
    process.env.MODE_PUBLIC_ORIGIN = origin;
    const request = new Request("http://internal:3000/api/auth/login", { method: "POST" });
    assert.throws(() => assertSameOrigin(request), /MODE_PUBLIC_ORIGIN/);
    assert.throws(() => sessionCookie("token", "2026-10-18T00:00:00Z", request), /MODE_PUBLIC_ORIGIN/);
  }
});

test("unknown-account login executes the same password derivation as an existing wrong password", t => {
  const { db } = memoryDatabase();
  t.after(() => db.close());
  const scrypt = t.mock.method(crypto, "scryptSync");
  syncBuiltinESMExports();
  t.after(() => { scrypt.mock.restore(); syncBuiltinESMExports(); });
  assert.throws(() => db.login({ email: "absent-readiness@example.com", password: "incorrect" }), UnauthorizedError);
  assert.equal(scrypt.mock.callCount(), 1, "unknown accounts must execute the dummy password check");
  assert.throws(() => db.login({ email: DEMO.organizer, password: "incorrect" }), UnauthorizedError);
  assert.equal(scrypt.mock.callCount(), 2, "known accounts must execute one derivation too");
});

test("production rejects an explicitly configured public demo password", t => {
  environment(t, { NODE_ENV: "production", MODE_DEMO_PASSWORD: "mode-demo-2026" });
  assert.throws(() => demoPassword(), /private|public/);
});

test("production refuses a promoted database with unchanged public demo passwords", t => {
  environment(t, { NODE_ENV: "development", MODE_DEMO_PASSWORD: undefined, MODE_SEED: undefined });
  const directory = mkdtempSync(join(tmpdir(), "mode-readiness-promotion-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, "mode.sqlite");
  openClubDatabase(filename).close();
  Object.assign(process.env, { NODE_ENV: "production" });
  // Neither changing the seed flag nor supplying a new environment password rotates stored hashes.
  process.env.MODE_SEED = "none";
  process.env.MODE_DEMO_PASSWORD = "private-future-seed-password";
  assert.throws(() => { openClubDatabase(filename).close(); }, /public demo password/);
});

test("production permits privately seeded databases and empty real-club initialization", t => {
  environment(t, { NODE_ENV: "production", MODE_DEMO_PASSWORD: "private-demo-test-password", MODE_SEED: undefined });
  const seeded = openClubDatabase(":memory:");
  try { assert.ok(seeded.login({ email: DEMO.admin, password: "private-demo-test-password" }).token); }
  finally { seeded.close(); }
  process.env.MODE_SEED = "none";
  delete process.env.MODE_DEMO_PASSWORD;
  const empty = openClubDatabase(":memory:");
  try { assert.deepEqual(empty.getMembers(), []); } finally { empty.close(); }
});

test("rotating all synthetic passwords lets an existing database open in production", t => {
  environment(t, { NODE_ENV: "development", MODE_DEMO_PASSWORD: undefined, MODE_SEED: undefined });
  const directory = mkdtempSync(join(tmpdir(), "mode-readiness-rotation-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, "mode.sqlite");
  const db = openClubDatabase(filename);
  try {
    const session = db.login({ email: DEMO.admin, password: demoPassword() });
    const admin = db.getActor(session.token)!;
    for (const account of [...DEMO_OFFICERS, ...DEMO_MEMBERS]) {
      db.setPassword(admin, account.id, "rotated-private-test-password");
    }
    assert.equal(db.getActor(session.token), null, "rotation revokes the earlier admin session");
  } finally { db.close(); }
  Object.assign(process.env, { NODE_ENV: "production" });
  const production = openClubDatabase(filename);
  try { assert.ok(production.login({ email: DEMO.admin, password: "rotated-private-test-password" }).token); }
  finally { production.close(); }
});
