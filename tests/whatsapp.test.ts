import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { getDatabase, openClubDatabase } from "../src/lib/database";
import { ConflictError, ForbiddenError, ValidationError } from "../src/lib/errors";
import { WHATSAPP_CLAIM_TTL_MS } from "../src/lib/modules/whatsapp";
import { runWhatsAppBatch } from "../src/lib/whatsapp-worker";
import { actorFor, apiRequest, DEMO, loginCookie, memoryDatabase, routeParams, TEST_DATABASE_URL, withRouteDatabase } from "./helpers";
import { GET as getPreferences, PUT as putPreferences } from "../src/app/api/whatsapp/preferences/route";
import { GET as getGroup, PUT as putGroup } from "../src/app/api/whatsapp/group/route";
import { GET as getDeliveries } from "../src/app/api/whatsapp/deliveries/route";
import { POST as retryDelivery } from "../src/app/api/whatsapp/deliveries/[id]/retry/route";

const publication = { idempotencyKey: "whatsapp-1", title: "Club update", body: "A synthetic announcement." };
const preference = { phone: "+919876543210", enabled: true };
const group = { destination: "synthetic-group", enabled: true };

test("group settings and queue operations stay within the officer's club", () => {
  const { db } = memoryDatabase();
  try {
    const first = actorFor(db, DEMO.organizer);
    const clubId = db.createClub("Second club");
    db.createMemberWithCredentials({ name: "Other Lead", email: "whatsapp-other@example.test", password: "other-pass-123", role: "admin", clubId });
    const other = actorFor(db, "whatsapp-other@example.test", "other-pass-123");
    db.whatsapp.saveGroup(first, group);
    db.announcements.publish(first, publication);
    assert.deepEqual(db.whatsapp.group(other), { destination: null, enabled: false });
    assert.deepEqual(db.whatsapp.list(other), []);
    assert.equal(db.whatsapp.claimNext(other.clubId), null);
    const claim = db.whatsapp.claimNext(first.clubId)!;
    db.whatsapp.settle(claim, { status: "failed", code: "provider_rejected" });
    assert.throws(() => db.whatsapp.retry(other, claim.id), ConflictError);
    db.whatsapp.saveGroup(other, { destination: "other-group", enabled: true });
    assert.deepEqual(db.whatsapp.group(first), group);
  } finally { db.close(); }
});

test("v13 upgrades preserve existing records; queued messages and preferences survive reopening", { skip: TEST_DATABASE_URL ? "SQLite upgrade fixture" : false }, async () => {
  await withRouteDatabase(async () => {
    const original = getDatabase();
    const memberCount = original.getMembers().length;
    original.close();
    const raw = new DatabaseSync(process.env.SQLITE_PATH!);
    raw.exec(`DROP TABLE whatsapp_deliveries; DROP TABLE whatsapp_preferences; DROP TABLE whatsapp_groups;
      DROP INDEX members_club_identity_idx; PRAGMA user_version = 13;`);
    raw.close();
    let db = openClubDatabase(process.env.SQLITE_PATH!);
    try {
      assert.equal(db.getMembers().length, memberCount);
      const officer = actorFor(db, DEMO.organizer);
      db.whatsapp.saveGroup(officer, group);
      db.announcements.publish(officer, publication);
      const id = db.whatsapp.list(officer)[0].id;
      db.close();
      db = openClubDatabase(process.env.SQLITE_PATH!);
      const reopened = actorFor(db, DEMO.organizer);
      assert.deepEqual(db.whatsapp.group(reopened), group);
      assert.equal(db.whatsapp.list(reopened)[0].id, id);
      assert.equal(db.whatsapp.list(reopened)[0].status, "pending");
    } finally { db.close(); }
  });
});

test("WhatsApp defaults to disabled; publication queues only opted-in members and one group, atomically and once", () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    const member = actorFor(db, "active@example.com");
    assert.deepEqual(db.whatsapp.preferences(member), { phone: null, enabled: false });
    db.announcements.publish(officer, { ...publication, idempotencyKey: "disabled" });
    assert.deepEqual(db.whatsapp.list(officer), []);
    db.whatsapp.savePreferences(member, preference);
    db.whatsapp.saveGroup(officer, group);
    const result = db.announcements.publish(officer, publication);
    assert.equal(result.recipientCount, 3);
    assert.deepEqual(db.whatsapp.list(officer).map((row) => row.audience).sort(), ["group", "member"]);
    db.announcements.publish(officer, publication);
    assert.equal(db.whatsapp.list(officer).length, 2);
    assert.equal(db.dues.notificationsFor(member).filter((item) => item.announcementId === result.announcement.id).length, 1);
    assert.throws(() => db.whatsapp.list(member), ForbiddenError);
    assert.throws(() => db.whatsapp.saveGroup(member, group), ForbiddenError);
    assert.throws(() => db.whatsapp.savePreferences(member, { phone: "9876543210", enabled: true }), ValidationError);
    assert.throws(() => db.whatsapp.savePreferences(member, { phone: null, enabled: true }), ValidationError);
  } finally { db.close(); }
});

test("renewal reminders queue privately and retries do not repeat WhatsApp messages", () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    db.whatsapp.saveGroup(officer, group);
    const due = db.dues.expiringWithin(officer, 365);
    assert.ok(due.length > 0);
    for (const candidate of due) db.whatsapp.savePreferences({ ...officer, memberId: candidate.id, role: "member", email: candidate.email }, { ...preference, phone: `+9198765${String(due.indexOf(candidate)).padStart(5, "0")}` });
    const first = db.dues.sendRenewalReminders(officer, 365);
    assert.ok(first.sent > 0);
    const deliveries = db.whatsapp.list(officer);
    assert.equal(deliveries.length, first.sent);
    assert.ok(deliveries.every((row) => row.kind === "membership_renewal" && row.audience === "member"));
    db.dues.sendRenewalReminders(officer, 365);
    assert.equal(db.whatsapp.list(officer).length, deliveries.length);
  } finally { db.close(); }
});

test("changing preferences or group cancels pending snapshots and cannot revive old notifications", () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    const member = actorFor(db, "active@example.com");
    db.whatsapp.savePreferences(member, preference);
    db.whatsapp.saveGroup(officer, group);
    db.announcements.publish(officer, publication);
    db.whatsapp.savePreferences(member, { phone: null, enabled: false });
    db.whatsapp.saveGroup(officer, { destination: "different-group", enabled: true });
    assert.ok(db.whatsapp.list(officer).every((row) => row.status === "cancelled"));
    db.whatsapp.savePreferences(member, preference);
    assert.equal(db.whatsapp.claimNext(officer.clubId), null);
  } finally { db.close(); }
});

test("disabled worker makes no claims; overlapping workers submit each queued message once", async () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    db.whatsapp.saveGroup(officer, group);
    db.announcements.publish(officer, publication);
    assert.deepEqual(await runWhatsAppBatch(db.whatsapp, officer.clubId), { enabled: false, processed: 0 });
    assert.equal(db.whatsapp.list(officer)[0].attempts, 0);
    let calls = 0;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const transport = { send: async () => { calls++; await waiting; return { status: "accepted" as const, messageId: "synthetic-message" }; } };
    const first = runWhatsAppBatch(db.whatsapp, officer.clubId, transport);
    assert.deepEqual(await runWhatsAppBatch(db.whatsapp, officer.clubId, transport), { enabled: true, processed: 0 });
    release(); await first;
    assert.equal(calls, 1);
    assert.equal(db.whatsapp.list(officer)[0].status, "accepted");
    assert.throws(() => db.whatsapp.retry(officer, db.whatsapp.list(officer)[0].id), ConflictError);
  } finally { db.close(); }
});

test("ambiguous submissions stay uncertain and provider exception details are not exposed", async () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    db.whatsapp.saveGroup(officer, group);
    db.announcements.publish(officer, publication);
    await runWhatsAppBatch(db.whatsapp, officer.clubId, { send: async () => { throw new Error("private-token-and-number"); } });
    const row = db.whatsapp.list(officer)[0];
    assert.equal(row.status, "uncertain");
    assert.equal(row.errorCode, "submission_unknown");
    assert.ok(!JSON.stringify(row).includes("private-token"));
    assert.throws(() => db.whatsapp.retry(officer, row.id), ConflictError);
    assert.equal(db.whatsapp.claimNext(officer.clubId), null);
  } finally { db.close(); }
});

test("expired worker claims are uncertain; stale results cannot overwrite the state", () => {
  const { db, clock } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    db.whatsapp.saveGroup(officer, group);
    db.announcements.publish(officer, publication);
    const claim = db.whatsapp.claimNext(officer.clubId)!;
    assert.ok(claim);
    clock.now = new Date(clock.now.getTime() + WHATSAPP_CLAIM_TTL_MS + 1);
    assert.equal(db.whatsapp.claimNext(officer.clubId), null);
    assert.equal(db.whatsapp.list(officer)[0].status, "uncertain");
    assert.equal(db.whatsapp.settle(claim, { status: "accepted", messageId: "late" }), false);
  } finally { db.close(); }
});

test("confirmed failures require officer retries and stop after three submissions", async () => {
  const { db } = memoryDatabase();
  try {
    const officer = actorFor(db, DEMO.organizer);
    db.whatsapp.saveGroup(officer, group);
    db.announcements.publish(officer, publication);
    const id = db.whatsapp.list(officer)[0].id;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await runWhatsAppBatch(db.whatsapp, officer.clubId, { send: async () => ({ status: "failed", code: "provider_rejected" }) });
      assert.equal(db.whatsapp.list(officer)[0].attempts, attempt);
      if (attempt < 3) db.whatsapp.retry(officer, id);
    }
    assert.throws(() => db.whatsapp.retry(officer, id), ConflictError);
  } finally { db.close(); }
});

test("queue failure rolls back publication and notifications", { skip: TEST_DATABASE_URL ? "SQLite failure trigger" : false }, async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const raw = new DatabaseSync(process.env.SQLITE_PATH!);
    try {
      const officer = actorFor(db, DEMO.organizer);
      db.whatsapp.saveGroup(officer, group);
      const before = db.announcements.listPublished(officer.clubId).length;
      raw.exec("CREATE TRIGGER fail_whatsapp BEFORE INSERT ON whatsapp_deliveries BEGIN SELECT RAISE(ABORT, 'injected queue failure'); END");
      assert.throws(() => db.announcements.publish(officer, publication), /injected queue failure/);
      assert.equal(db.announcements.listPublished(officer.clubId).length, before);
      raw.exec("DROP TRIGGER fail_whatsapp");
      assert.equal(db.announcements.publish(officer, publication).created, true);
      assert.equal(db.whatsapp.list(officer).length, 1);
    } finally { raw.close(); }
  });
});

test("WhatsApp routes enforce login, role checks, same-origin mutations and strict self-service fields", async () => {
  await withRouteDatabase(async () => {
    assert.equal((await getPreferences(apiRequest("/api/whatsapp/preferences"))).status, 401);
    const member = await loginCookie("active@example.com");
    const officer = await loginCookie(DEMO.organizer);
    assert.equal((await getGroup(apiRequest("/api/whatsapp/group", { cookie: member }))).status, 403);
    assert.equal((await getDeliveries(apiRequest("/api/whatsapp/deliveries", { cookie: member }))).status, 403);
    const path = "/api/whatsapp/preferences";
    assert.equal((await putPreferences(apiRequest(path, { cookie: member, method: "PUT", body: preference, origin: "https://outside.example" }))).status, 403);
    assert.equal((await putPreferences(apiRequest(path, { cookie: member, method: "PUT", body: { ...preference, memberId: "another-member" } }))).status, 400);
    assert.equal((await putPreferences(apiRequest(path, { cookie: member, method: "PUT", body: preference }))).status, 200);
    assert.equal((await (await getPreferences(apiRequest(path, { cookie: member }))).json()).preferences.phone, preference.phone);
    assert.equal((await (await getPreferences(apiRequest(path, { cookie: officer }))).json()).preferences.phone, null);
    assert.equal((await putGroup(apiRequest("/api/whatsapp/group", { cookie: officer, method: "PUT", body: group }))).status, 200);
    assert.equal((await retryDelivery(apiRequest("/api/whatsapp/deliveries/missing/retry", { cookie: member, method: "POST" }), routeParams({ id: "missing" }))).status, 403);
    const result = await getDeliveries(apiRequest("/api/whatsapp/deliveries", { cookie: officer }));
    assert.deepEqual(await result.json(), { deliveries: [], senderReady: false });
  });
});
