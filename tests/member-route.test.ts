import assert from "node:assert/strict";
import { test } from "node:test";
import { GET, POST } from "../src/app/api/members/route";
import { getDatabase } from "../src/lib/database";
import { rejectUnsafeMutation } from "../src/lib/mutation-guard";
import { DEMO, apiRequest, loginCookie, withRouteDatabase } from "./helpers";

test("member API requires an officer session and returns actionable status codes", async () => {
  await withRouteDatabase(async () => {
    const payload = { name: "Test Student", email: "api@example.com" };
    assert.equal((await POST(apiRequest("/api/members", { body: payload }))).status, 401);
    assert.equal((await GET(apiRequest("/api/members"))).status, 401);

    const memberCookie = await loginCookie(DEMO.volunteer);
    assert.equal((await POST(apiRequest("/api/members", { body: payload, cookie: memberCookie }))).status, 403);
    assert.equal((await GET(apiRequest("/api/members", { cookie: memberCookie }))).status, 403);

    const organizer = await loginCookie(DEMO.organizer);
    assert.equal((await POST(apiRequest("/api/members", { rawBody: "{broken", cookie: organizer }))).status, 400);
    assert.equal((await POST(apiRequest("/api/members", { body: { name: "A", email: "bad" }, cookie: organizer }))).status, 400);
    assert.equal((await POST(apiRequest("/api/members", { body: payload, cookie: organizer, origin: "https://other.example" }))).status, 403);

    const created = await POST(apiRequest("/api/members", { body: payload, cookie: organizer }));
    assert.equal(created.status, 201);
    assert.equal((await created.json()).member.email, "api@example.com");

    const duplicate = await POST(apiRequest("/api/members", { body: { name: "Another Student", email: "API@EXAMPLE.COM" }, cookie: organizer }));
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).error, /already exists/);

    const list = await GET(apiRequest("/api/members", { cookie: organizer }));
    assert.equal(list.status, 200);
    assert.equal((await list.json()).members.length, getDatabase().getMembers().length);
  });
});

test("mutation guard uses the direct Host when Next.js normalizes the request URL", () => {
  const request = new Request("http://localhost:3000/api/members", {
    method: "POST",
    headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Sec-Fetch-Site": "same-origin" },
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
