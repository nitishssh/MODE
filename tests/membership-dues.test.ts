import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as duesRoute } from "../src/app/api/membership/dues/route";
import { GET as expiringRoute } from "../src/app/api/membership/expiring/route";
import { POST as remindersRoute } from "../src/app/api/membership/reminders/run/route";
import { GET as notificationsRoute } from "../src/app/api/notifications/route";
import { openClubDatabase } from "../src/lib/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../src/lib/errors";
import { DEMO, actorFor, apiRequest, loginCookie, withRouteDatabase } from "./helpers";

function clockDb() {
  const clock = { now: new Date("2026-10-10T08:00:00.000Z") }; // club date 2026-10-10
  const db = openClubDatabase(":memory:", { now: () => new Date(clock.now) });
  return { db, clock };
}

test("first payment, early renewal and expired renewal follow the +365 rule and post one ledger row each", () => {
  const { db, clock } = clockDb();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const member = db.createMember({ name: "Dues Student", email: "dues@example.com" });
    assert.equal(member.membership, "none");
    const before = db.ledger.balance();

    const first = db.dues.recordDues(organizer, { memberId: member.id, reference: "UPI-1" });
    assert.deepEqual([first.created, first.payment.amountPaise, first.payment.previousExpiresOn, first.expiresOn, first.membership], [true, 50000, null, "2027-10-10", "active"]);
    assert.equal(db.ledger.balance(), before + 50000);
    assert.equal(first.payment.recordedBy, organizer.memberId);

    const replay = db.dues.recordDues(organizer, { memberId: member.id, reference: "UPI-1" });
    assert.equal(replay.created, false);
    assert.equal(db.ledger.balance(), before + 50000, "duplicate recording credits nothing");
    assert.equal(db.dues.paymentsFor(organizer.clubId, member.id).length, 1);

    // Early renewal: continues from the current expiry, not from today.
    clock.now = new Date("2027-06-01T08:00:00.000Z");
    const early = db.dues.recordDues(organizer, { memberId: member.id, reference: "UPI-2" });
    assert.equal(early.payment.previousExpiresOn, "2027-10-10");
    assert.equal(early.expiresOn, "2028-10-09", "365 days after 2027-10-10 across the 2028 leap day");

    // Expired renewal: starts from today.
    clock.now = new Date("2029-01-15T08:00:00.000Z");
    assert.equal(db.findMember(organizer.clubId, member.id)?.membership, "expired");
    const late = db.dues.recordDues(organizer, { memberId: member.id, reference: "UPI-3" });
    assert.equal(late.expiresOn, "2030-01-15");
    assert.equal(late.membership, "active");

    const other = db.createMember({ name: "Other", email: "other@example.com" });
    assert.throws(() => db.dues.recordDues(organizer, { memberId: other.id, reference: "UPI-1" }), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_reused");
    assert.throws(() => db.dues.recordDues(organizer, { memberId: "missing", reference: "UPI-9" }), NotFoundError);
    assert.throws(() => db.dues.recordDues(actorFor(db, DEMO.volunteer), { memberId: other.id, reference: "UPI-9" }), ForbiddenError);
    const report = db.ledger.reconcile();
    assert.deepEqual([report.orphans, report.duplicates, report.unsourced], [[], [], 0]);
    assert.equal(db.ledger.list().filter((e) => e.sourceType === "dues_payment").length, 3);
  } finally {
    db.close();
  }
});

test("membership is valid through the expiry day in club time and expired the next club day", () => {
  const { db, clock } = clockDb();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const member = db.createMember({ name: "Boundary", email: "boundary@example.com" });
    db.dues.recordDues(organizer, { memberId: member.id, reference: "B-1" });
    clock.now = new Date("2027-10-10T18:29:00.000Z"); // 23:59 IST on the expiry day
    assert.equal(db.findMember(organizer.clubId, member.id)?.membership, "active");
    clock.now = new Date("2027-10-10T18:31:00.000Z"); // 00:01 IST next day
    assert.equal(db.findMember(organizer.clubId, member.id)?.membership, "expired");
  } finally {
    db.close();
  }
});

test("reminders: expiring list, one notification and one simulated outbox row per member per expiry, repeats skipped", () => {
  const { db, clock } = clockDb();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    // Seeded Rohan (demo-member-2) also expires in late September 2027; renew him first so only `soon` is in the window.
    db.dues.recordDues(organizer, { memberId: "demo-member-2", reference: "R-1" });
    const soon = db.createMember({ name: "Soon", email: "soon@example.com" });
    db.dues.recordDues(organizer, { memberId: soon.id, reference: "S-1" }); // expires 2027-10-10
    clock.now = new Date("2027-09-20T08:00:00.000Z"); // 20 days before
    const expiring = db.dues.expiringWithin(organizer, 30);
    assert.deepEqual(expiring.map((m) => [m.id, m.daysLeft]), [[soon.id, 20]]);
    assert.throws(() => db.dues.expiringWithin(actorFor(db, DEMO.volunteer)), ForbiddenError);

    const run1 = db.dues.sendRenewalReminders(organizer);
    assert.deepEqual([run1.candidates, run1.sent, run1.skipped], [1, 1, 0]);
    const run2 = db.dues.sendRenewalReminders(organizer);
    assert.deepEqual([run2.sent, run2.skipped], [0, 1], "UNIQUE(member_id, expires_on) blocks the repeat");
    assert.equal(db.dues.simulatedOutbox(organizer).length, 1);
    assert.equal(db.dues.simulatedOutbox(organizer)[0].status, "simulated");

    db.setPassword(actorFor(db, DEMO.admin), soon.id, "soon-pass-2026");
    const soonActor = actorFor(db, "soon@example.com", "soon-pass-2026");
    const inbox = db.dues.notificationsFor(soonActor);
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].title, /ends on 2027-10-10/);

    // Renewing moves the expiry, so a new reminder is allowed for the new date later.
    db.dues.recordDues(organizer, { memberId: soon.id, reference: "S-2" });
    assert.equal(db.dues.sendRenewalReminders(organizer).candidates, 0);
    assert.throws(() => db.dues.sendRenewalReminders(actorFor(db, DEMO.treasurer)), ForbiddenError);
  } finally {
    db.close();
  }
});

test("dues routes: permissions, 201 then 200 on replay, expiring and reminders", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const members = await (await (await import("../src/app/api/members/route")).GET(apiRequest("/api/members", { cookie: organizer }))).json();
    const expired = members.members.find((m: { email: string }) => m.email === "expired@example.com");
    const body = { memberId: expired.id, reference: "ROUTE-1" };
    assert.equal((await duesRoute(apiRequest("/api/membership/dues", { body }))).status, 401);
    assert.equal((await duesRoute(apiRequest("/api/membership/dues", { body, cookie: await loginCookie(DEMO.volunteer) }))).status, 403);
    const first = await duesRoute(apiRequest("/api/membership/dues", { body, cookie: organizer }));
    assert.equal(first.status, 201);
    assert.equal((await first.json()).membership, "active");
    assert.equal((await duesRoute(apiRequest("/api/membership/dues", { body, cookie: organizer }))).status, 200);
    const expiring = await expiringRoute(apiRequest("/api/membership/expiring?days=365", { cookie: organizer }));
    assert.equal(expiring.status, 200);
    assert.ok((await expiring.json()).members.length >= 3);
    assert.equal((await expiringRoute(apiRequest("/api/membership/expiring?days=9999", { cookie: organizer }))).status, 400);
    const run = await remindersRoute(apiRequest("/api/membership/reminders/run", { body: { days: 365 }, cookie: organizer }));
    assert.equal(run.status, 200);
    assert.ok((await run.json()).sent >= 3);
    const inbox = await notificationsRoute(apiRequest("/api/notifications", { cookie: await loginCookie("active@example.com") }));
    assert.equal(inbox.status, 200);
    assert.equal((await inbox.json()).notifications.length, 1);
  });
});
