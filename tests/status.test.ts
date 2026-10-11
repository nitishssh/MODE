import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServiceChecks } from "../src/lib/service-checks";
import { DatabaseSync } from "node:sqlite";
import { GET } from "../src/app/api/status/route";
import { getDatabase } from "../src/lib/database";
import {
  activeIncidents, isFresh, serviceState, snapshotSchema, statusNoticesSchema, statusOverview,
  type StatusNotices, type StatusSnapshot,
} from "../src/lib/status";
import { withRouteDatabase } from "./helpers";

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const notices: StatusNotices = {
  incidents: [{ id: "database-issue", title: "Database issue", services: ["database"], impact: "partial_outage", updates: [
    { at: "2026-10-11T11:00:00.000Z", stage: "investigating", message: "Investigating connectivity." },
    { at: "2026-10-11T13:00:00.000Z", stage: "resolved", message: "Recovered." },
  ] }],
  maintenance: [{ id: "planned-work", title: "Database work", description: "Planned work.", services: ["database"], startsAt: "2026-10-11T11:30:00.000Z", endsAt: "2026-10-11T12:30:00.000Z" }],
};

test("public status works without credentials or JWT configuration and reveals no private data", async () => {
  await withRouteDatabase(async () => {
    const previous = process.env.MODE_JWT_SECRET;
    delete process.env.MODE_JWT_SECRET;
    try {
      const response = await GET();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("set-cookie"), null);
      const snapshot = snapshotSchema.parse(await response.json());
      assert.equal(snapshot.services.find(s => s.id === "api")!.state, "operational");
      assert.ok(["operational", "degraded"].includes(snapshot.services.find(s => s.id === "database")!.state));
      assert.equal(snapshot.services.find(s => s.id === "auth")!.state, "major_outage");
      assert.ok(snapshot.services.filter(s => !["api", "auth"].includes(s.id)).every(s => ["operational", "degraded"].includes(s.state)));
      assert.doesNotMatch(JSON.stringify(snapshot), /schemaVersion|sqlite|postgres|password|secret|@|memberId/);
      assert.ok(isFresh(snapshot, Date.now()));
    } finally {
      if (previous === undefined) delete process.env.MODE_JWT_SECRET;
      else process.env.MODE_JWT_SECRET = previous;
    }
  });
});

test("database failure is reported without breaking the public endpoint or exposing the exception", async () => {
  await delay(5100); // Allow the public endpoint's shared probe cache to expire.
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const original = db.health;
    db.health = () => { throw new Error("postgres://private:secret@host/member-data"); };
    try {
      const response = await GET();
      assert.equal(response.status, 200);
      const snapshot = snapshotSchema.parse(await response.json());
      assert.equal(snapshot.services.find(s => s.id === "database")!.state, "major_outage");
      assert.equal(typeof snapshot.services.find(s => s.id === "database")!.latencyMs, "number");
      assert.equal(statusOverview(snapshot, true).state, "major_outage");
      assert.doesNotMatch(JSON.stringify(snapshot), /private|secret|member-data/);
      db.health = original;
      const cachedFailure = snapshotSchema.parse(await (await GET()).json());
      assert.equal(cachedFailure.checkedAt, snapshot.checkedAt);
      await delay(5100);
      const recovered = snapshotSchema.parse(await (await GET()).json());
      assert.notEqual(recovered.services.find(s => s.id === "database")!.state, "major_outage");
    } finally { db.health = original; }
  });
});

test("maintenance and resolved reports cannot conceal observed outages", () => {
  assert.equal(serviceState("database", "major_outage", notices, NOW), "major_outage");
  assert.equal(serviceState("database", "operational", notices, NOW), "partial_outage");
  assert.equal(serviceState("database", "operational", { incidents: [], maintenance: notices.maintenance }, NOW), "maintenance");
  assert.equal(serviceState("database", "major_outage", notices, NOW + 4_000_000), "major_outage");
  assert.equal(serviceState("database", "operational", notices, NOW + 4_000_000), "operational");
  assert.equal(serviceState("auth", "unknown", notices, NOW), "unknown");
  assert.equal(activeIncidents(notices, NOW).length, 1);
  assert.equal(activeIncidents(notices, NOW + 4_000_000).length, 0);
});

test("missing, stale and future timestamps cannot retain a healthy overview", () => {
  const sample = { checkedAt: new Date(NOW).toISOString(), services: [
    { id: "api", state: "operational", latencyMs: null },
    { id: "auth", state: "unknown", latencyMs: null },
  ], notices: { incidents: [], maintenance: [] } } as StatusSnapshot;
  assert.equal(isFresh(null, NOW), false);
  assert.equal(isFresh(sample, NOW + 120_001), false);
  assert.equal(isFresh(sample, NOW - 31_000), false);
  assert.equal(isFresh(sample, NOW + 30_001), false);
  assert.equal(isFresh(sample, NOW + 20_000), true);
  assert.equal(statusOverview(sample, false).state, "unknown");
  assert.equal(statusOverview(sample, true).title, "Some checks are not yet available");
});

test("readiness probes detect missing feature storage without touching other services or real receipts", async () => {
  const db = new DatabaseSync(":memory:");
  const directory = mkdtempSync(join(tmpdir(), "mode-status-check-"));
  const realReceipt = join(directory, "existing-receipt.txt");
  writeFileSync(realReceipt, "Preserve this receipt");
  try {
    for (const table of ["members", "sessions", "events", "tickets", "dues_payments", "products", "product_variants", "merch_orders", "expense_receipts"]) db.exec(`CREATE TABLE ${table} (id TEXT)`);
    const checks = createServiceChecks(db, directory);
    checks.auth(); checks.events(); checks.memberships(); checks.merchandise();
    await checks.receipts();
    assert.deepEqual(readdirSync(directory), ["existing-receipt.txt"]);
    assert.equal(readFileSync(realReceipt, "utf8"), "Preserve this receipt");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get()!.n, 0);
    db.exec("DROP TABLE tickets");
    assert.throws(checks.events);
    assert.doesNotThrow(checks.memberships);
    const invalidStorage = createServiceChecks(db, realReceipt);
    await assert.rejects(invalidStorage.receipts());
    assert.equal(readFileSync(realReceipt, "utf8"), "Preserve this receipt");
  } finally {
    db.close(); unlinkSync(realReceipt); rmdirSync(directory);
  }
});

test("editorial notices reject unknown services, backwards timelines and invalid maintenance", () => {
  assert.ok(statusNoticesSchema.safeParse(notices).success);
  assert.equal(statusNoticesSchema.safeParse({ ...notices, maintenance: [{ ...notices.maintenance[0], endsAt: "2026-10-11T10:00:00.000Z" }] }).success, false);
  assert.equal(statusNoticesSchema.safeParse({ ...notices, incidents: [{ ...notices.incidents[0], services: ["private-admin"] }] }).success, false);
  assert.equal(statusNoticesSchema.safeParse({ ...notices, incidents: [{ ...notices.incidents[0], updates: [...notices.incidents[0].updates].reverse() }] }).success, false);
  assert.equal(statusNoticesSchema.safeParse({ incidents: [], maintenance: [{ ...notices.maintenance[0], startsAt: "2026-10-11T12:00:00Z", endsAt: "2026-10-11T12:00:00.500Z" }] }).success, true);
});
