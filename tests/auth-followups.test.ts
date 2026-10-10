import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as setPassword } from "../src/app/api/members/[id]/password/route";
import { POST as createMember } from "../src/app/api/members/route";
import { verifyPassword } from "../src/lib/auth/password";
import { sessionCookie } from "../src/lib/auth/session";
import { getDatabase } from "../src/lib/database";
import { demoPassword } from "../src/lib/db/migrations";
import { DEMO, actorFor, apiRequest, loginCookie, routeParams, withRouteDatabase } from "./helpers";

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const prior = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("production refuses the public default demo password", () => {
  withEnv({ NODE_ENV: "production", MODE_DEMO_PASSWORD: undefined }, () => {
    assert.throws(() => demoPassword(), /MODE_DEMO_PASSWORD must be set/);
  });
  withEnv({ NODE_ENV: "production", MODE_DEMO_PASSWORD: "hosted-secret-123" }, () => {
    assert.equal(demoPassword(), "hosted-secret-123");
  });
  withEnv({ NODE_ENV: "test", MODE_DEMO_PASSWORD: undefined }, () => {
    assert.equal(demoPassword(), "mode-demo-2026");
  });
});

test("unknown accounts still fail closed after the constant-cost check", () => {
  assert.equal(verifyPassword("anything", null), false);
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
});

test("session cookie is Secure on HTTPS and behind a TLS-terminating proxy only", () => {
  const plain = sessionCookie("t", new Date().toISOString(), new Request("http://localhost:3000/api/auth/login"));
  assert.ok(!plain.includes("Secure"));
  const direct = sessionCookie("t", new Date().toISOString(), new Request("https://mode.example/api/auth/login"));
  assert.ok(direct.includes("; Secure"));
  const proxied = sessionCookie(
    "t",
    new Date().toISOString(),
    new Request("http://internal:3000/api/auth/login", { headers: { "x-forwarded-proto": "https" } }),
  );
  assert.ok(proxied.includes("; Secure"));
});

test("admin gives an officer-created member a password, and only admins can", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const created = await createMember(apiRequest("/api/members", { body: { name: "Ravi Kumar", email: "ravi@example.com" }, cookie: organizer }));
    assert.equal(created.status, 201);
    const { member } = await created.json();

    // Creation and its audit entry commit together.
    const db = getDatabase();
    const admin = actorFor(db, DEMO.admin);
    assert.ok(db.listAudit(admin, "member").some((event) => event.action === "member.created" && event.entityId === member.id));

    // No password yet: the member cannot sign in.
    const before = await login(apiRequest("/api/auth/login", { body: { email: "ravi@example.com", password: "ravi-pass-123" } }));
    assert.equal(before.status, 401);

    const params = routeParams({ id: member.id });
    const path = `/api/members/${member.id}/password`;
    assert.equal((await setPassword(apiRequest(path, { body: { password: "ravi-pass-123" } }), params)).status, 401);
    assert.equal((await setPassword(apiRequest(path, { body: { password: "ravi-pass-123" }, cookie: organizer }), params)).status, 403);
    const adminCookie = await loginCookie(DEMO.admin);
    assert.equal((await setPassword(apiRequest(path, { body: { password: "short" }, cookie: adminCookie }), params)).status, 400);
    assert.equal(
      (await setPassword(apiRequest(path, { body: { password: "ravi-pass-123" }, cookie: adminCookie, origin: "https://evil.example" }), params)).status,
      403,
    );
    const missing = routeParams({ id: "no-such-member" });
    assert.equal((await setPassword(apiRequest("/api/members/no-such-member/password", { body: { password: "ravi-pass-123" }, cookie: adminCookie }), missing)).status, 404);

    const ok = await setPassword(apiRequest(path, { body: { password: "ravi-pass-123" }, cookie: adminCookie }), params);
    assert.equal(ok.status, 200);
    assert.ok(db.listAudit(admin, "member").some((event) => event.action === "member.password_set" && event.entityId === member.id));

    const after = await login(apiRequest("/api/auth/login", { body: { email: "ravi@example.com", password: "ravi-pass-123" } }));
    assert.equal(after.status, 200);
  });
});
