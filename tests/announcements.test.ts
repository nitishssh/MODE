import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { getDatabase, openClubDatabase } from "../src/lib/database";
import { DEFAULT_CLUB_ID, migrate, SCHEMA_VERSION } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { actorFor, apiRequest, DEMO, FIXED_NOW, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";
import { GET as archive, POST as publish } from "../src/app/api/announcements/route";
import { GET as detail } from "../src/app/api/announcements/[id]/route";
import { GET as outbox } from "../src/app/api/announcements/[id]/outbox/route";
import { GET as notifications } from "../src/app/api/notifications/route";

const input = { idempotencyKey: "synthetic-welcome-1", title: "Club welcome", body: "Meet us at the fictional welcome desk." };

test("publication validates input and enforces every role at the domain boundary", () => {
  const { db } = memoryDatabase();
  try {
    for (const email of ["active@example.com", DEMO.volunteer, DEMO.treasurer]) {
      const actor = actorFor(db, email);
      assert.throws(() => db.announcements.publish(actor, input), ForbiddenError);
      assert.throws(() => db.announcements.inspectOutbox(actor, "demo-announcement-1"), ForbiddenError);
    }
    for (const email of [DEMO.organizer, DEMO.admin]) {
      const actor = actorFor(db, email);
      for (const bad of [
        { ...input, title: "  " }, { ...input, title: "x".repeat(161) },
        { ...input, body: " " }, { ...input, body: "x".repeat(10001) },
        { ...input, idempotencyKey: " " }, { ...input, idempotencyKey: "x".repeat(121) },
        { ...input, audience: "all" }, { ...input, publishedBy: "forged" },
      ]) assert.throws(() => db.announcements.publish(actor, bad), ValidationError);
      const result = db.announcements.publish(actor, { ...input, idempotencyKey: email, title: " Club welcome " });
      assert.equal(result.announcement.title, input.title);
      assert.equal(result.created, true);
      assert.equal(result.recipientCount, 3);
      assert.equal(result.delivery, "simulated");
      assert.equal(db.announcements.inspectOutbox(actor, result.announcement.id).messages.length, 3);
    }
  } finally { db.close(); }
});

test("publication freezes active recipients at IST midnight and retries do not add new members", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const raw = new DatabaseSync(process.env.SQLITE_PATH!);
    try {
      raw.exec("UPDATE members SET expires_on = NULL");
      const set = raw.prepare("UPDATE members SET expires_on = ?, dues_status = ? WHERE id = ?");
      set.run("2026-10-10", "unpaid", "demo-member-1");
      set.run("2026-10-11", "unpaid", "demo-member-2");
      set.run("2026-10-09", "paid", "demo-member-expired");
      const actor = actorFor(db, DEMO.organizer);
      const first = db.announcements.publish(actor, input);
      assert.equal(first.recipientCount, 2);
      assert.deepEqual(db.announcements.inspectOutbox(actor, first.announcement.id).messages.map(r => r.memberId).sort(), ["demo-member-1", "demo-member-2"]);
      assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM notifications WHERE announcement_id = ?").get(first.announcement.id)!.n, 2);
      set.run("2027-01-01", "paid", "demo-member-3");
      process.env.MODE_DEMO_NOW = "2026-10-10T18:30:00.000Z";
      const retry = db.announcements.publish(actor, input);
      assert.deepEqual(retry, { ...first, created: false });
      assert.throws(() => db.announcements.publish(actor, { ...input, body: "Changed" }), ConflictError);
      const second = db.announcements.publish(actor, { ...input, idempotencyKey: "after-midnight" });
      assert.deepEqual(db.announcements.inspectOutbox(actor, second.announcement.id).messages.map(r => r.memberId).sort(), ["demo-member-2", "demo-member-3"]);
      assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'announcement.published'").get()!.n, 2);
      for (const table of ["notifications", "outbox_messages"]) {
        // The database itself also rejects a duplicate pair, independent of the request check.
        const row = raw.prepare(`SELECT * FROM ${table} WHERE announcement_id = ? LIMIT 1`).get(first.announcement.id)!;
        const columns = Object.keys(row);
        assert.throws(() => raw.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
          .run(...columns.map(c => c === "id" ? "duplicate" : row[c])), /UNIQUE/);
      }
    } finally { raw.close(); }
  });
});

test("failure in either delivery table or audit rolls back publication and permits a clean retry", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const actor = actorFor(db, DEMO.organizer);
    const raw = new DatabaseSync(process.env.SQLITE_PATH!);
    try {
      for (const table of ["outbox_messages", "notifications", "audit_events"]) {
        const key = `failure-${table}`;
        const condition = table === "audit_events" ? "NEW.action = 'announcement.published'" : "NEW.member_id = 'demo-member-2'";
        raw.exec(`CREATE TRIGGER fail_publication BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, 'injected failure'); END`);
        assert.throws(() => db.announcements.publish(actor, { ...input, idempotencyKey: key }), /injected failure/);
        assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM announcements WHERE idempotency_key = ?").get(key)!.n, 0);
        assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM notifications WHERE announcement_id NOT IN (SELECT id FROM announcements)").get()!.n, 0);
        assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM outbox_messages WHERE announcement_id NOT IN (SELECT id FROM announcements)").get()!.n, 0);
        const expected = ["outbox_messages", "notifications", "audit_events"].indexOf(table) * 3;
        assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'announcement'").get()!.n, expected);
        assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM outbox_messages WHERE kind = 'announcement'").get()!.n, expected);
        raw.exec("DROP TRIGGER fail_publication");
        assert.equal(db.announcements.publish(actor, { ...input, idempotencyKey: key }).recipientCount, 3);
      }
      // Persisted retry survives a new connection, as it would after a server restart.
      const reopened = openClubDatabase(process.env.SQLITE_PATH!, { now: () => FIXED_NOW });
      try { assert.equal(reopened.announcements.publish(actor, { ...input, idempotencyKey: "failure-audit_events" }).created, false); }
      finally { reopened.close(); }
    } finally { raw.close(); }
  });
});

test("public archive/detail hide recipients; HTTP routes enforce auth, validation, CSRF and notification isolation", async () => {
  await withRouteDatabase(async () => {
    assert.equal((await publish(apiRequest("/api/announcements", { body: input }))).status, 401);
    assert.equal((await notifications(apiRequest("/api/notifications"))).status, 401);
    const organizer = await loginCookie(DEMO.organizer);
    for (const email of ["active@example.com", DEMO.volunteer, DEMO.treasurer]) {
      const cookie = await loginCookie(email);
      assert.equal((await publish(apiRequest("/api/announcements", { cookie, body: input }))).status, 403);
      assert.equal((await outbox(apiRequest("/api/announcements/x/outbox", { cookie }), routeParams({ id: "x" }))).status, 403);
    }
    for (const body of [{ ...input, recipientIds: ["demo-member-expired"] }, { title: "Hello", body: "Body" }]) {
      assert.equal((await publish(apiRequest("/api/announcements", { cookie: organizer, body }))).status, 400);
    }
    assert.equal((await publish(apiRequest("/api/announcements", { cookie: organizer, rawBody: "{" }))).status, 400);
    assert.equal((await publish(apiRequest("/api/announcements", { cookie: organizer, origin: "https://elsewhere.example", body: input }))).status, 403);
    const response = await publish(apiRequest("/api/announcements", { cookie: organizer, body: input }));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.deepEqual(Object.keys(result).sort(), ["announcement", "created", "delivery", "recipientCount"]);
    assert.equal((await publish(apiRequest("/api/announcements", { cookie: organizer, body: input }))).status, 200);
    assert.equal((await publish(apiRequest("/api/announcements", { cookie: organizer, body: { ...input, title: "Correction" } }))).status, 409);
    const params = routeParams({ id: result.announcement.id });
    const publicDetail = await detail(apiRequest("/api/announcements/id"), params);
    assert.equal(publicDetail.status, 200);
    assert.deepEqual(Object.keys((await publicDetail.json()).announcement).sort(), ["body", "id", "publishedAt", "title"]);
    const items = (await (await archive(apiRequest("/api/announcements"))).json()).announcements;
    assert.equal(items[0].id, result.announcement.id);
    assert.equal((await detail(apiRequest("/api/announcements/missing"), routeParams({ id: "missing" }))).status, 404);
    assert.equal((await outbox(apiRequest("/api/announcements/id/outbox"), params)).status, 401);
    const inspection = await outbox(apiRequest("/api/announcements/id/outbox", { cookie: organizer }), params);
    assert.equal(inspection.headers.get("Cache-Control"), "no-store");
    const delivery = await inspection.json();
    assert.equal(delivery.delivery, "simulated");
    assert.equal(delivery.messages.length, 3);
    assert.ok(delivery.messages.every((row: { status: string }) => row.status === "simulated"));
    for (const [email, count] of [["active@example.com", 1], ["expired@example.com", 0], [DEMO.organizer, 0]] as const) {
      const cookie = await loginCookie(email);
      const response = await notifications(apiRequest("/api/notifications?memberId=demo-member-active", { cookie }));
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      const rows = (await response.json()).notifications;
      assert.equal(rows.length, count);
      if (count) assert.equal(rows[0].announcementId, result.announcement.id);
    }
    // Native clients publish with a valid bearer and no browser Origin.
    const token = getDatabase().login({ email: DEMO.admin, password: process.env.MODE_DEMO_PASSWORD || "mode-demo-2026" }).token;
    assert.equal((await publish(apiRequest("/api/announcements", { authorization: `Bearer ${token}`, origin: null, body: { ...input, idempotencyKey: "native" } }))).status, 201);
  });
});

test("club boundaries isolate archive, dashboard, idempotency keys, outbox and recipients; empty publication succeeds", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const first = db.announcements.publish(organizer, input);
    const clubId = db.createClub("Other synthetic club");
    db.createMemberWithCredentials({ name: "Other Lead", email: "other@example.com", password: "other-pass-123", role: "admin", clubId });
    const other = actorFor(db, "other@example.com", "other-pass-123");
    assert.deepEqual(db.announcements.listPublished(clubId), []);
    assert.deepEqual(db.getDashboard(other).announcements, []);
    assert.throws(() => db.announcements.getPublished(clubId, first.announcement.id), NotFoundError);
    assert.throws(() => db.announcements.inspectOutbox(other, first.announcement.id), NotFoundError);
    const empty = db.announcements.publish(other, input);
    assert.equal(empty.created, true);
    assert.equal(empty.recipientCount, 0);
    assert.deepEqual(db.announcements.inspectOutbox(other, empty.announcement.id).messages, []);
    assert.deepEqual(db.dues.notificationsFor(other), []);
    assert.equal(db.announcements.listPublished(DEFAULT_CLUB_ID).some(a => a.id === empty.announcement.id), false);
    assert.equal(db.getDashboard().announcements.some(a => a.id === empty.announcement.id), false);
  } finally { db.close(); }
});

test("v9 databases receive announcement migration and retain legacy archive/reminder rows", () => {
  const raw = new DatabaseSync(":memory:");
  try {
    raw.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE clubs (id TEXT PRIMARY KEY);
      INSERT INTO clubs VALUES ('${DEFAULT_CLUB_ID}');
      CREATE TABLE members (id TEXT PRIMARY KEY);
      CREATE TABLE announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, published_at TEXT NOT NULL);
      INSERT INTO announcements VALUES ('legacy', 'Old notice', 'Keep this', '2026-10-09T08:00:00.000Z');
      CREATE TABLE notifications (id TEXT PRIMARY KEY, member_id TEXT, kind TEXT);
      INSERT INTO notifications VALUES ('reminder', NULL, 'membership_renewal');
      CREATE TABLE outbox_messages (id TEXT PRIMARY KEY, member_id TEXT, kind TEXT);
      INSERT INTO outbox_messages VALUES ('reminder', NULL, 'membership_renewal');
      PRAGMA user_version = 9;
    `);
    migrate(raw, FIXED_NOW);
    migrate(raw, FIXED_NOW);
    assert.equal(raw.prepare("PRAGMA user_version").get()!.user_version, SCHEMA_VERSION);
    const legacy = raw.prepare("SELECT * FROM announcements WHERE id = 'legacy'").get()!;
    assert.equal(legacy.club_id, DEFAULT_CLUB_ID);
    assert.equal(legacy.body, "Keep this");
    assert.equal(legacy.recipient_count, 0);
    for (const table of ["notifications", "outbox_messages"]) {
      assert.equal(raw.prepare(`SELECT announcement_id FROM ${table} WHERE id = 'reminder'`).get()!.announcement_id, null);
    }
  } finally { raw.close(); }
});
