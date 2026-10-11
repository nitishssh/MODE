import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationError } from "../src/lib/errors";
import { json, route } from "../src/lib/http";
import { GET as live } from "../src/app/api/health/live/route";
import { GET as ready } from "../src/app/api/health/ready/route";
import { getDatabase } from "../src/lib/database";
import { apiRequest, withRouteDatabase } from "./helpers";

const knownId = "e194c753-52b8-4a70-a5e9-9089e82946f3";

test("request correlation preserves cookies/status and records no request payload", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (line: string) => logs.push(line));
  const handler = route("synthetic write", async () => {
    const response = json({ stored: true }, { status: 201 });
    response.headers.append("Set-Cookie", "first=one; HttpOnly");
    response.headers.append("Set-Cookie", "second=two; HttpOnly");
    return response;
  });
  const response = await handler(new Request("http://localhost/api/private?secret=QUERY_CANARY", {
    method: "POST",
    headers: { "x-request-id": knownId, authorization: "Bearer TOKEN_CANARY", cookie: "COOKIE_CANARY" },
    body: "BODY_CANARY",
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-request-id"), knownId);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), { stored: true });
  assert.equal(logs.length, 1);
  const record = JSON.parse(logs[0]);
  assert.equal(record.requestId, knownId);
  assert.equal(record.operation, "synthetic write");
  assert.equal(record.status, 201);
  assert.ok(record.durationMs >= 0);
  assert.doesNotMatch(logs.join(""), /CANARY|authorization|cookie|\/api\/private/i);
});

test("unexpected failures are correlated without logging raw errors or unsafe request IDs", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "error", (line: string) => logs.push(line));
  const response = await route("synthetic failure", () => {
    throw new Error("DATABASE_PASSWORD_CANARY");
  })(new Request("http://localhost/api/example", { headers: { "x-request-id": "UNSAFE_ID_CANARY" } }));
  assert.equal(response.status, 500);
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0]).requestId, response.headers.get("x-request-id"));
  assert.equal(JSON.parse(logs[0]).outcome, "server_error");
  assert.doesNotMatch(logs.join(""), /CANARY/);
  assert.doesNotMatch(await response.text(), /CANARY/);
});

test("domain errors, immutable redirects and failed log sinks retain their response semantics", async (t) => {
  t.mock.method(console, "info", () => { throw new Error("sink unavailable"); });
  const rejected = await route("validation", () => { throw new ValidationError("Required field missing."); })(apiRequest("/api/example"));
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).code, "validation_failed");
  assert.ok(rejected.headers.get("x-request-id"));
  const redirected = await route("redirect", () => Response.redirect("http://localhost/login", 303))(apiRequest("/api/example"));
  assert.equal(redirected.status, 303);
  assert.equal(redirected.headers.get("location"), "http://localhost/login");
  assert.ok(redirected.headers.get("x-request-id"));
});

test("database failure makes readiness unavailable while liveness remains healthy", async (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
  await withRouteDatabase(async () => {
    const healthy = await ready(apiRequest("/api/health/ready"));
    assert.equal(healthy.status, 200);
    assert.equal((await healthy.json()).checks.database, "ok");
    const database = getDatabase();
    const original = database.health;
    database.health = () => { throw new Error("PRIVATE_STORAGE_CANARY"); };
    try {
      const unavailable = await ready(apiRequest("/api/health/ready"));
      assert.equal(unavailable.status, 503);
      assert.doesNotMatch(await unavailable.text(), /CANARY/);
      const alive = await live(apiRequest("/api/health/live"));
      assert.equal(alive.status, 200);
      assert.deepEqual(await alive.json(), { status: "ok" });
    } finally {
      database.health = original;
    }
  });
});
