import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { POST } from "../src/app/api/members/route";
import { getDatabase } from "../src/lib/database";
import { rejectUnsafeMutation } from "../src/lib/mutation-guard";

test("member API returns actionable status codes and rejects malformed requests", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-api-test-"));
  const priorPath = process.env.SQLITE_PATH;
  const priorWrites = process.env.MODE_ENABLE_DEMO_WRITES;
  process.env.SQLITE_PATH = join(directory, "mode.sqlite");
  process.env.MODE_ENABLE_DEMO_WRITES = "true";
  const request = (body: string, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body,
  });
  try {
    assert.equal((await POST(request("{broken"))).status, 400);
    assert.equal((await POST(request(JSON.stringify({ name: "A", email: "bad" })))).status, 400);
    assert.equal((await POST(request(JSON.stringify({ name: "Test Student", email: "api@example.com" }), "https://other.example"))).status, 403);
    const created = await POST(request(JSON.stringify({ name: "Test Student", email: "api@example.com" })));
    assert.equal(created.status, 201);
    assert.equal((await created.json()).member.email, "api@example.com");
    const duplicate = await POST(request(JSON.stringify({ name: "Another Student", email: "API@EXAMPLE.COM" })));
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).error, /already exists/);
    assert.equal(getDatabase().getMembers().length, 4);
  } finally {
    getDatabase().close();
    if (priorPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = priorPath;
    if (priorWrites === undefined) delete process.env.MODE_ENABLE_DEMO_WRITES;
    else process.env.MODE_ENABLE_DEMO_WRITES = priorWrites;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("mutation guard disables production writes unless explicitly enabled", () => {
  const priorEnvironment = process.env.NODE_ENV;
  const priorWrites = process.env.MODE_ENABLE_DEMO_WRITES;
  const environment = process.env as Record<string, string | undefined>;
  try {
    environment.NODE_ENV = "production";
    delete process.env.MODE_ENABLE_DEMO_WRITES;
    const request = new Request("http://localhost:3000/api/members", { method: "POST" });
    assert.equal(rejectUnsafeMutation(request)?.status, 403);
    process.env.MODE_ENABLE_DEMO_WRITES = "true";
    assert.equal(rejectUnsafeMutation(request), null);
  } finally {
    if (priorEnvironment === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = priorEnvironment;
    if (priorWrites === undefined) delete process.env.MODE_ENABLE_DEMO_WRITES;
    else process.env.MODE_ENABLE_DEMO_WRITES = priorWrites;
  }
});

test("mutation guard uses the direct Host when Next.js normalizes the request URL", () => {
  const request = new Request("http://localhost:3000/api/members", {
    method: "POST",
    headers: {
      Host: "127.0.0.1:3000",
      Origin: "http://127.0.0.1:3000",
      "Sec-Fetch-Site": "same-origin",
    },
  });
  assert.equal(rejectUnsafeMutation(request), null);
});

test("mutation guard rejects different origins and ignores forwarded authority headers", () => {
  for (const origin of ["https://other.example", "http://127.0.0.1:3001", "http://localhost:3000"]) {
    const request = new Request("http://localhost:3000/api/members", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3000",
        Origin: origin,
        "X-Forwarded-Host": new URL(origin).host,
        "X-Forwarded-Proto": new URL(origin).protocol.slice(0, -1),
        Forwarded: `host=${new URL(origin).host};proto=${new URL(origin).protocol.slice(0, -1)}`,
      },
    });
    assert.equal(rejectUnsafeMutation(request)?.status, 403);
  }
  const crossSite = new Request("http://localhost:3000/api/members", {
    method: "POST",
    headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(rejectUnsafeMutation(crossSite)?.status, 403);
});

test("mutation guard rejects malformed Host authorities", () => {
  for (const host of ["", "localhost:3000/ignored", "user@localhost:3000", "localhost:3000,other.example", "localhost:not-a-port"]) {
    const request = new Request("http://localhost:3000/api/members", {
      method: "POST",
      headers: { Host: host, Origin: "http://localhost:3000" },
    });
    assert.equal(rejectUnsafeMutation(request)?.status, 403);
  }
});
