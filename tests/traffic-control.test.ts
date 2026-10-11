import assert from "node:assert/strict";
import test from "node:test";
import { CapacityError, RateLimitError } from "../src/lib/errors";
import { errorResponse, json, route } from "../src/lib/http";
import { AdmissionGate, TokenBucketStore, resetTrafficControlForTests } from "../src/lib/traffic-control";

test("token buckets allow a bounded burst, refill with monotonic time and stay memory bounded", () => {
  let now = 0;
  const store = new TokenBucketStore(() => now, 2, 10_000);
  const spec = { capacity: 2, refillTokens: 2, refillMs: 1_000 };
  assert.equal(store.takeMany([{ key: "a", spec }]).allowed, true);
  assert.equal(store.takeMany([{ key: "a", spec }]).remaining, 0);
  const denied = store.takeMany([{ key: "a", spec }]);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);
  now = 500;
  assert.equal(store.takeMany([{ key: "a", spec }]).allowed, true);

  store.takeMany([{ key: "b", spec }]);
  store.takeMany([{ key: "c", spec }]);
  assert.equal(store.size, 2, "oldest idle key is evicted at the cardinality bound");
});

test("multi-bucket decisions are atomic when one scope is exhausted", () => {
  const store = new TokenBucketStore(() => 0);
  const one = { capacity: 1, refillTokens: 1, refillMs: 60_000 };
  assert.equal(store.takeMany([{ key: "blocked", spec: one }]).allowed, true);
  assert.equal(store.takeMany([{ key: "available", spec: one }, { key: "blocked", spec: one }]).allowed, false);
  assert.equal(store.takeMany([{ key: "available", spec: one }]).allowed, true, "failed combined decision did not consume another scope");
});

test("admission sheds low-priority work at the soft limit and all work at the hard limit", async () => {
  const gate = new AdmissionGate(1, 2);
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  const first = gate.run("normal", () => new Promise<void>((resolve) => { releaseFirst = resolve; }));
  await assert.rejects(() => gate.run("shed-first", async () => undefined), CapacityError);
  const second = gate.run("critical", () => new Promise<void>((resolve) => { releaseSecond = resolve; }));
  await assert.rejects(() => gate.run("critical", async () => undefined), CapacityError);
  assert.equal(gate.inFlight, 2);
  releaseFirst();
  releaseSecond();
  await Promise.all([first, second]);
  assert.equal(gate.inFlight, 0);
});

test("rate and capacity errors carry retry metadata and are never cacheable", async () => {
  const limited = errorResponse(new RateLimitError(3, 5, 0, 10), "test");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "3");
  assert.equal(limited.headers.get("ratelimit-limit"), "5");
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.equal((await limited.json()).code, "rate_limited");

  const busy = errorResponse(new CapacityError("Busy", "http_in_flight", 1), "test");
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get("retry-after"), "1");
  assert.equal((await busy.json()).code, "server_busy");
});

test("every route response has a correlation ID and unexpected errors stay private", async () => {
  const success = await route("success", () => json({ ok: true }))(new Request("http://localhost/api/test"));
  assert.match(success.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);

  const original = console.error;
  const logs: string[] = [];
  console.error = (...items) => { logs.push(items.map(String).join(" ")); };
  try {
    const failed = errorResponse(new Error("private database detail"), "test route", "request-test-1");
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get("x-request-id"), "request-test-1");
    const body = await failed.json();
    assert.deepEqual(body, {
      error: "Something went wrong. Please try again.",
      code: "internal_error",
      requestId: "request-test-1",
    });
    assert.doesNotMatch(JSON.stringify(body), /private database detail/);
    assert.match(logs.join("\n"), /request-test-1/);
    assert.match(logs.join("\n"), /route_exception/);
  } finally {
    console.error = original;
  }
});

test("workspace summary publishes its budget and rejects the sixth immediate account request", async () => {
  const [{ GET: summaryRoute }, { DEMO, apiRequest, loginCookie, withRouteDatabase }] = await Promise.all([
    import("../src/app/api/workspace/summary/route"),
    import("./helpers"),
  ]);
  resetTrafficControlForTests();
  await withRouteDatabase(async () => {
    const cookie = await loginCookie(DEMO.organizer);
    for (let remaining = 4; remaining >= 0; remaining -= 1) {
      const response = await summaryRoute(apiRequest("/api/workspace/summary", { cookie }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("ratelimit-limit"), "5");
      assert.equal(response.headers.get("ratelimit-remaining"), String(remaining));
    }
    const limited = await summaryRoute(apiRequest("/api/workspace/summary", { cookie }));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "2");
    assert.equal((await limited.json()).code, "rate_limited");
  });
  resetTrafficControlForTests();
});
