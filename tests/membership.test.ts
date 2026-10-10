import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as recordDues } from "../src/app/api/membership/payments/route";
import { GET as plans } from "../src/app/api/membership/plans/route";
import { POST as runReminders } from "../src/app/api/membership/reminders/run/route";
import { POST as dispatchOutbox } from "../src/app/api/outbox/dispatch/route";
import { GET as listOutbox } from "../src/app/api/outbox/route";
import { PLAN_ANNUAL_ID, PLAN_FREE_ID } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, withRouteDatabase } from "./helpers";

const newMember = (db: ReturnType<typeof memoryDatabase>["db"], email: string) =>
  db.createMember({ name: "Fresh Student", email });

test("paid dues create one membership, one payment and one ledger entry; replays credit nothing", () => {
  const { db } = memoryDatabase();
  try {
    const treasurer = actorFor(db, DEMO.treasurer);
    const member = newMember(db, "dues@example.com");
    const before = db.getDashboard(treasurer).metrics.balancePaise;

    const first = db.membership.recordDues(treasurer, { memberId: member.id, planId: PLAN_ANNUAL_ID, paymentReference: "UPI-1001", amountPaise: 50000 });
    assert.equal(first.created, true);
    assert.equal(first.membership.startsOn, "2026-10-10");
    assert.equal(first.membership.expiresOn, "2027-10-10");
    assert.equal(first.status.active, true);
    assert.equal(first.status.memberPricing, true);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 50000);
    assert.equal(db.getMembers().find((m) => m.id === member.id)?.duesStatus, "paid");

    const replay = db.membership.recordDues(treasurer, { memberId: member.id, planId: PLAN_ANNUAL_ID, paymentReference: "UPI-1001", amountPaise: 50000 });
    assert.equal(replay.created, false);
    assert.equal(replay.membership.id, first.membership.id);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 50000, "no double credit");
    assert.equal(db.membership.history(treasurer.clubId, member.id).length, 1);

    const other = newMember(db, "other@example.com");
    assert.throws(() => db.membership.recordDues(treasurer, { memberId: other.id, planId: PLAN_ANNUAL_ID, paymentReference: "UPI-1001", amountPaise: 50000 }), ConflictError);
    assert.throws(() => db.membership.recordDues(treasurer, { memberId: other.id, planId: PLAN_ANNUAL_ID, paymentReference: "UPI-1002", amountPaise: 49999 }), ValidationError);
    assert.throws(() => db.membership.recordDues(treasurer, { memberId: other.id, planId: PLAN_ANNUAL_ID }), ValidationError);
    assert.throws(() => db.membership.recordDues(treasurer, { memberId: other.id, planId: "plan-missing", paymentReference: "UPI-1003", amountPaise: 1 }), NotFoundError);
    assert.throws(() => db.membership.recordDues(treasurer, { memberId: "missing", planId: PLAN_ANNUAL_ID, paymentReference: "UPI-1004", amountPaise: 50000 }), NotFoundError);
    assert.throws(() => db.membership.recordDues(actorFor(db, DEMO.volunteer), { memberId: other.id, planId: PLAN_FREE_ID }), ForbiddenError);
  } finally {
    db.close();
  }
});

test("expiry boundary, deterministic renewal and loss of member pricing after expiry", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const member = newMember(db, "boundary@example.com");
    db.membership.recordDues(organizer, { memberId: member.id, planId: PLAN_ANNUAL_ID, paymentReference: "REF-A", amountPaise: 50000 });
    const clubId = organizer.clubId;

    // Valid through the expiry day in club time (UTC+05:30), expired the next club day.
    clock.now = new Date("2027-10-10T18:29:00.000Z");
    assert.equal(db.membership.statusFor(clubId, member.id).active, true);
    clock.now = new Date("2027-10-10T18:31:00.000Z");
    const expired = db.membership.statusFor(clubId, member.id);
    assert.equal(expired.active, false);
    assert.equal(expired.memberPricing, false);
    assert.equal(expired.expiresOn, "2027-10-10");

    // Renewal after expiry starts today.
    const late = db.membership.recordDues(organizer, { memberId: member.id, planId: PLAN_ANNUAL_ID, paymentReference: "REF-B", amountPaise: 50000 });
    assert.equal(late.membership.startsOn, "2027-10-11");
    assert.equal(late.membership.expiresOn, "2028-10-10", "365 days across the 2028 leap day");

    // Renewal before expiry continues from the day after the current expiry.
    clock.now = new Date("2028-06-01T08:00:00.000Z");
    const early = db.membership.recordDues(organizer, { memberId: member.id, planId: PLAN_ANNUAL_ID, paymentReference: "REF-C", amountPaise: 50000 });
    assert.equal(early.membership.startsOn, "2028-10-11");
    assert.equal(early.membership.expiresOn, "2029-10-11");
    assert.equal(db.membership.statusFor(clubId, member.id).current?.id, late.membership.id, "current period unchanged until it ends");
    assert.equal(db.membership.history(clubId, member.id).length, 3);
  } finally {
    db.close();
  }
});

test("free plan enrolments are idempotent per active period and grant no member pricing", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const member = newMember(db, "free@example.com");
    const enrolled = db.membership.recordDues(organizer, { memberId: member.id, planId: PLAN_FREE_ID });
    assert.equal(enrolled.payment, null);
    assert.equal(enrolled.status.active, true);
    assert.equal(enrolled.status.memberPricing, false);
    assert.throws(() => db.membership.recordDues(organizer, { memberId: member.id, planId: PLAN_FREE_ID }), ConflictError);
    assert.equal(db.getMembers().find((m) => m.id === member.id)?.duesStatus, "unpaid");
  } finally {
    db.close();
  }
});

test("renewal reminders target expiring memberships once and skip renewed members", async () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const soon = newMember(db, "soon@example.com");
    const later = newMember(db, "later@example.com");
    db.membership.recordDues(organizer, { memberId: soon.id, planId: PLAN_ANNUAL_ID, paymentReference: "R-1", amountPaise: 50000 });
    clock.now = new Date("2026-12-01T08:00:00.000Z");
    db.membership.recordDues(organizer, { memberId: later.id, planId: PLAN_ANNUAL_ID, paymentReference: "R-2", amountPaise: 50000 });

    // Demo clock: 10 days before the first membership ends.
    clock.now = new Date("2027-09-30T08:00:00.000Z");
    const first = db.membership.runRenewalReminders(organizer, { daysAhead: 14 });
    assert.equal(first.created, 1);
    assert.equal(first.skipped, 0);
    const second = db.membership.runRenewalReminders(organizer, { daysAhead: 14 });
    assert.deepEqual([second.created, second.skipped], [0, 1], "repeat run queues nothing new");

    const queued = db.outbox.list(organizer, { kind: "membership_renewal" });
    assert.equal(queued.length, 1);
    assert.equal(queued[0].status, "pending");
    assert.equal(queued[0].recipient, "s***@example.com", "recipient is masked");

    const dispatched = await db.outbox.dispatch(organizer);
    assert.equal(dispatched.transport, "preview");
    assert.equal(dispatched.previewed, 1);
    assert.equal(db.outbox.list(organizer)[0].status, "previewed");
    assert.notEqual(db.outbox.list(organizer)[0].status, "sent", "a preview is never reported as sent");

    // Renewing removes the member from future reminder candidates for that period.
    db.membership.recordDues(organizer, { memberId: soon.id, planId: PLAN_ANNUAL_ID, paymentReference: "R-3", amountPaise: 50000 });
    const third = db.membership.runRenewalReminders(organizer, { daysAhead: 14 });
    assert.equal(third.candidates, 0);
    assert.throws(() => db.membership.runRenewalReminders(actorFor(db, DEMO.treasurer)), ForbiddenError);
  } finally {
    db.close();
  }
});

test("membership routes enforce permissions and report created versus replayed", async () => {
  await withRouteDatabase(async () => {
    const publicPlans = await plans(apiRequest("/api/membership/plans"));
    assert.equal(publicPlans.status, 200);
    assert.equal((await publicPlans.json()).plans.length, 2);

    const organizer = await loginCookie(DEMO.organizer);
    const created = await (await (await import("../src/app/api/members/route")).POST(apiRequest("/api/members", { body: { name: "Route Student", email: "route@example.com" }, cookie: organizer }))).json();
    const body = { memberId: created.member.id, planId: PLAN_ANNUAL_ID, paymentReference: "ROUTE-1", amountPaise: 50000 };

    assert.equal((await recordDues(apiRequest("/api/membership/payments", { body }))).status, 401);
    assert.equal((await recordDues(apiRequest("/api/membership/payments", { body, cookie: await loginCookie(DEMO.volunteer) }))).status, 403);
    assert.equal((await recordDues(apiRequest("/api/membership/payments", { body: { ...body, amountPaise: 1 }, cookie: organizer }))).status, 400);
    const first = await recordDues(apiRequest("/api/membership/payments", { body, cookie: organizer }));
    assert.equal(first.status, 201);
    const replay = await recordDues(apiRequest("/api/membership/payments", { body, cookie: organizer }));
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).created, false);

    assert.equal((await runReminders(apiRequest("/api/membership/reminders/run", { method: "POST", cookie: await loginCookie(DEMO.treasurer) }))).status, 403);
    const run = await runReminders(apiRequest("/api/membership/reminders/run", { method: "POST", cookie: organizer }));
    assert.equal(run.status, 200);
    assert.equal((await run.json()).created, 0, "nothing expires within the default window");

    assert.equal((await listOutbox(apiRequest("/api/outbox"))).status, 401);
    const outbox = await listOutbox(apiRequest("/api/outbox", { cookie: organizer }));
    assert.equal(outbox.status, 200);
    assert.equal((await outbox.json()).transport, "preview");
    assert.equal((await dispatchOutbox(apiRequest("/api/outbox/dispatch", { method: "POST", cookie: organizer }))).status, 200);
  });
});
