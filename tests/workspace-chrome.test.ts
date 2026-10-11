import assert from "node:assert/strict";
import test from "node:test";
import { GET as summaryRoute } from "../src/app/api/workspace/summary/route";
import { GET as searchRoute } from "../src/app/api/workspace/search/route";
import { actorFor, apiRequest, DEMO, loginCookie, memoryDatabase, withRouteDatabase } from "./helpers";

test("workspace chrome uses bounded counts and permission-scoped search", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const volunteer = actorFor(db, DEMO.volunteer);
    const summary = db.getWorkspaceChrome(organizer);
    assert.equal(summary.club.name, "Sample Student Club");
    assert.equal(summary.counts.members, db.getMembers().length);
    assert.ok(summary.counts.tasks >= summary.counts.completedTasks);
    assert.ok(summary.counts.unreadNotifications >= 0);

    const organizerResults = db.searchWorkspace(organizer, "asha", 6);
    assert.ok(organizerResults.some((result) => result.kind === "member" && result.label === "Asha Demo"));
    assert.ok(organizerResults.length <= 6);
    assert.ok(db.searchWorkspace(volunteer, "asha", 6).every((result) => result.kind !== "member"));
    assert.deepEqual(db.searchWorkspace(organizer, "a", 6), []);
    assert.deepEqual(db.searchWorkspace(organizer, "%", 6), [], "LIKE wildcards are treated literally");
  } finally {
    db.close();
  }
});

test("workspace summary and search routes require a session and keep responses small", async () => {
  await withRouteDatabase(async () => {
    assert.equal((await summaryRoute(apiRequest("/api/workspace/summary"))).status, 401);
    assert.equal((await searchRoute(apiRequest("/api/workspace/search?q=a"))).status, 400);

    const cookie = await loginCookie(DEMO.organizer);
    const summary = await summaryRoute(apiRequest("/api/workspace/summary", { cookie }));
    assert.equal(summary.status, 200);
    const summaryText = await summary.text();
    assert.ok(Buffer.byteLength(summaryText) < 1024, `summary was ${Buffer.byteLength(summaryText)} bytes`);
    assert.ok(JSON.parse(summaryText).counts.members > 0);

    const search = await searchRoute(apiRequest("/api/workspace/search?q=asha", { cookie }));
    assert.equal(search.status, 200);
    const body = await search.json();
    assert.ok(body.results.length <= 6);
    assert.ok(body.results.some((result: { kind: string; label: string }) => result.kind === "member" && result.label === "Asha Demo"));
  });
});
