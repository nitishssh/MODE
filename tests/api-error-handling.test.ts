import assert from "node:assert/strict";
import test from "node:test";
import { api, ApiError } from "../src/app/app/_lib/api";

test("web API rejects unreadable success responses", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>wrong server</html>", { status: 200, headers: { "X-Request-Id": "bad-response-1" } });
  try {
    await assert.rejects(api.get(`/api/test-invalid-${Date.now()}`), (error: unknown) =>
      error instanceof ApiError && error.code === "invalid_response" && error.requestId === "bad-response-1",
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("web API never automatically replays a mutation with an unknown outcome", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("connection reset"); };
  try {
    await assert.rejects(api.post("/api/test-mutation", { value: 1 }), (error: unknown) =>
      error instanceof ApiError && error.code === "unknown_outcome" && error.status === 0,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("web API retains server request IDs on business errors", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { error: "Conflict", code: "conflict", requestId: "body-reference" },
    { status: 409, headers: { "X-Request-Id": "header-reference" } },
  );
  try {
    await assert.rejects(api.post("/api/test-conflict", {}), (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.requestId === "header-reference",
    );
  } finally {
    globalThis.fetch = original;
  }
});
