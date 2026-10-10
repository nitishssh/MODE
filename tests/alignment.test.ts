import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { GET as lookupRoute } from "../src/app/api/members/lookup/route";
import { GET as rosterRoute } from "../src/app/api/membership/roster/route";
import { PLAN_ANNUAL_ID, PLAN_FREE_ID } from "../src/lib/db/migrations";
import { ForbiddenError, ValidationError } from "../src/lib/errors";
import type { Actor } from "../src/lib/modules/identity";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, withRouteDatabase } from "./helpers";

type Db = ReturnType<typeof memoryDatabase>["db"];

function memberActor(db: Db, email: string): Actor {
  db.createMemberWithCredentials({ name: `Member ${email}`, email, password: "member-pass-123", role: "member" });
  return actorFor(db, email, "member-pass-123");
}

test("door check: volunteers look up a member by email or name and get membership state, not the directory", () => {
  const { db, clock } = memoryDatabase();
  try {
    const volunteer = actorFor(db, DEMO.volunteer);
    const member = memberActor(db, "plain@example.com");
    assert.throws(() => db.membership.lookup(member, "asha"), ForbiddenError, "plain members cannot look people up");
    assert.throws(() => db.membership.lookup(volunteer, "a"), ValidationError, "at least two characters");

    const byEmail = db.membership.lookup(volunteer, "ASHA@example.com");
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0].name, "Asha Demo");
    assert.equal(byEmail[0].email, "a***@example.com", "address is masked");
    assert.deepEqual([byEmail[0].membership.active, byEmail[0].membership.memberPricing, byEmail[0].membership.planName], [true, true, "Annual member"]);

    const byName = db.membership.lookup(volunteer, "demo");
    assert.ok(byName.length >= 7 && byName.length <= 10, "partial name matches are capped");
    const meera = db.membership.lookup(volunteer, "Meera")[0];
    assert.deepEqual([meera.membership.active, meera.membership.planName, meera.membership.expiresOn], [false, null, null]);

    clock.now = new Date("2028-01-01T00:00:00.000Z");
    assert.equal(db.membership.lookup(volunteer, "asha@example.com")[0].membership.active, false, "expired members are reported as not active");
    assert.deepEqual(db.membership.lookup(volunteer, "nobody@example.com"), []);
  } finally {
    db.close();
  }
});

test("roster answers who still owes dues: expired first, then never-paid, then active by days left", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const lapsed = memberActor(db, "lapsed@example.com");
    db.membership.recordDues(organizer, { memberId: lapsed.memberId, planId: PLAN_FREE_ID });
    clock.now = new Date("2027-11-01T08:00:00.000Z");
    const roster = db.membership.roster(organizer);
    assert.equal(roster.length, db.getMembers(organizer.clubId).length);
    assert.equal(roster[0].state, "expired");
    assert.ok(roster[0].daysLeft! < 0);
    const states = roster.map((entry) => entry.state);
    assert.ok(states.indexOf("expired") < states.indexOf("never"), "expired before never");
    assert.equal(db.membership.roster(organizer, { state: "expired" }).length, 3, "Asha, Rohan and the free member all lapsed by Nov 2027");
    assert.equal(db.membership.roster(organizer, { state: "active" }).length, 0);

    clock.now = new Date("2026-10-10T08:00:00.000Z");
    const active = db.membership.roster(organizer, { state: "active" });
    assert.deepEqual(active.map((entry) => entry.name).sort(), ["Asha Demo", "Member lapsed@example.com", "Rohan Demo"]);
    assert.ok(active.every((entry) => entry.daysLeft! > 0));
    assert.throws(() => db.membership.roster(actorFor(db, DEMO.volunteer)), ForbiddenError, "roster shows emails, so it needs members:read");
  } finally {
    db.close();
  }
});

test("fundraiser goals: report shows raised versus target, remaining, percent and on-track from tasks and ledger", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const seeded = db.events.eventReport(organizer, "demo-event-2");
    assert.equal(seeded.event.goalPaise, 250000, "starter fundraiser carries a goal");
    assert.equal(seeded.fundraiser?.raisedPaise, 0);

    const sale = db.events.createEvent(organizer, { title: "Bake sale", description: "", startsAt: "2026-10-20T04:30:00.000Z", venue: "Quad", capacity: 50, memberPricePaise: 0, guestPricePaise: 10000, status: "published", goalPaise: 30000 });
    assert.equal(sale.goalPaise, 30000);
    const guest = memberActor(db, "sweettooth@example.com");
    const booking = db.events.bookEvent(guest, sale.id);
    db.events.confirmBooking(treasurer, booking.id, { paymentReference: "BAKE-1", amountPaise: 10000 });
    const supplies = db.treasury.submitExpense(actorFor(db, DEMO.volunteer), { amountPaise: 4000, purpose: "Flour and sugar", receiptReference: "RCPT-FLOUR", eventId: sale.id });
    db.treasury.decide(treasurer, supplies.id, "approved");
    db.treasury.markPaid(treasurer, supplies.id, "PAY-FLOUR");
    db.tasks.create(organizer, { title: "Bake 40 cookies", description: "", assigneeId: null, eventId: sale.id, dueAt: "2026-10-19T12:00:00.000Z", status: "in_progress" });
    db.tasks.create(organizer, { title: "Print price list", description: "", assigneeId: null, eventId: sale.id, dueAt: null, status: "done" });

    const report = db.events.eventReport(organizer, sale.id);
    assert.deepEqual([report.incomePaise, report.expensePaise, report.netPaise], [10000, 4000, 6000]);
    assert.deepEqual(report.fundraiser, { goalPaise: 30000, raisedPaise: 6000, remainingPaise: 24000, percent: 20, onTrack: true });
    assert.deepEqual(report.tasks, { total: 2, todo: 0, inProgress: 1, done: 1, overdue: 0 });

    clock.now = new Date("2026-10-19T13:00:00.000Z");
    const slipping = db.events.eventReport(organizer, sale.id);
    assert.equal(slipping.tasks.overdue, 1);
    assert.equal(slipping.fundraiser?.onTrack, false, "an overdue task before the goal is met means not on track");

    const raised = db.events.updateEvent(organizer, sale.id, { goalPaise: 5000 });
    assert.equal(raised.goalPaise, 5000);
    const met = db.events.eventReport(organizer, sale.id);
    assert.deepEqual([met.fundraiser?.percent, met.fundraiser?.remainingPaise, met.fundraiser?.onTrack], [100, 0, true]);
    assert.equal(db.events.updateEvent(organizer, sale.id, { goalPaise: null }).goalPaise, null, "goal can be removed");
    assert.equal(db.events.updateEvent(organizer, sale.id, { title: "Bake sale!" }).goalPaise, null, "omitting goalPaise leaves it alone");
  } finally {
    db.close();
  }
});

test("webhook transport delivers through the relay, records sent or failed, and never duplicates a send", async () => {
  const { db } = memoryDatabase();
  const received: Array<{ to: string; subject: string }> = [];
  let failNext = false;
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const payload = JSON.parse(raw) as { to: string; subject: string };
      if (failNext) {
        failNext = false;
        response.writeHead(503).end();
        return;
      }
      received.push(payload);
      response.writeHead(202).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const prior = { transport: process.env.MODE_MAIL_TRANSPORT, url: process.env.MODE_MAIL_WEBHOOK_URL };
  process.env.MODE_MAIL_TRANSPORT = "webhook";
  process.env.MODE_MAIL_WEBHOOK_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mail`;
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const draft = db.announcements.createDraft(organizer, { title: "Relay test", body: "Hello", audience: "active" });
    const published = db.announcements.publish(organizer, draft.id);
    assert.equal(published.queued, 2);
    assert.equal(published.delivery.transport, "webhook");

    failNext = true;
    const first = await db.outbox.dispatch(organizer);
    assert.deepEqual([first.transport, first.sent, first.failed, first.remaining], ["webhook", 1, 1, 1]);
    const afterFirst = db.announcements.deliverySummary(organizer, draft.id);
    assert.deepEqual(afterFirst.byStatus, { pending: 0, previewed: 0, sent: 1, failed: 1 });
    assert.match(db.outbox.list(organizer, { status: "failed" })[0].lastError ?? "", /503/);

    const second = await db.outbox.dispatch(organizer);
    assert.deepEqual([second.sent, second.failed, second.remaining], [1, 0, 0], "retry sends only the failed message");
    assert.equal(received.length, 2, "each recipient received exactly one relay call");
    assert.deepEqual(received.map((item) => item.subject), ["Relay test", "Relay test"]);
    const third = await db.outbox.dispatch(organizer);
    assert.deepEqual([third.sent, third.failed], [0, 0], "nothing left to send");
    assert.equal(db.announcements.deliverySummary(organizer, draft.id).byStatus.sent, 2);
  } finally {
    if (prior.transport === undefined) delete process.env.MODE_MAIL_TRANSPORT;
    else process.env.MODE_MAIL_TRANSPORT = prior.transport;
    if (prior.url === undefined) delete process.env.MODE_MAIL_WEBHOOK_URL;
    else process.env.MODE_MAIL_WEBHOOK_URL = prior.url;
    db.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("webhook transport without a URL falls back to preview and gives up after max attempts", async () => {
  const { db } = memoryDatabase();
  const prior = { transport: process.env.MODE_MAIL_TRANSPORT, url: process.env.MODE_MAIL_WEBHOOK_URL };
  process.env.MODE_MAIL_TRANSPORT = "webhook";
  delete process.env.MODE_MAIL_WEBHOOK_URL;
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const draft = db.announcements.createDraft(organizer, { title: "No relay configured", body: "x", audience: "active" });
    db.announcements.publish(organizer, draft.id);
    const result = await db.outbox.dispatch(organizer);
    assert.equal(result.transport, "preview", "a half-configured webhook never pretends to send");
    assert.equal(result.previewed, 2);

    process.env.MODE_MAIL_WEBHOOK_URL = "http://127.0.0.1:9/unreachable";
    const second = db.announcements.createDraft(organizer, { title: "Always failing", body: "x", audience: "active" });
    db.announcements.publish(organizer, second.id);
    const alwaysFail = async () => ({ ok: false, error: "simulated outage" });
    for (let attempt = 0; attempt < 5; attempt += 1) await db.outbox.dispatch(organizer, { deliver: alwaysFail });
    const exhausted = await db.outbox.dispatch(organizer, { deliver: alwaysFail });
    assert.deepEqual([exhausted.sent, exhausted.failed], [0, 0], "messages past maxAttempts are left for manual review");
    assert.equal(db.outbox.list(organizer, { status: "failed" }).length, 2);
    assert.equal(db.outbox.list(organizer, { status: "failed" })[0].attempts, 5);
  } finally {
    if (prior.transport === undefined) delete process.env.MODE_MAIL_TRANSPORT;
    else process.env.MODE_MAIL_TRANSPORT = prior.transport;
    if (prior.url === undefined) delete process.env.MODE_MAIL_WEBHOOK_URL;
    else process.env.MODE_MAIL_WEBHOOK_URL = prior.url;
    db.close();
  }
});

test("lookup and roster routes enforce the new permissions", async () => {
  await withRouteDatabase(async () => {
    assert.equal((await lookupRoute(apiRequest("/api/members/lookup?q=asha"))).status, 401);
    const volunteer = await loginCookie(DEMO.volunteer);
    assert.equal((await lookupRoute(apiRequest("/api/members/lookup?q=a", { cookie: volunteer }))).status, 400);
    const found = await lookupRoute(apiRequest("/api/members/lookup?q=asha@example.com", { cookie: volunteer }));
    assert.equal(found.status, 200);
    const matches = (await found.json()).matches;
    assert.equal(matches.length, 1);
    assert.equal(matches[0].membership.active, true);
    assert.ok(!matches[0].email.startsWith("asha@"), "masked");

    assert.equal((await rosterRoute(apiRequest("/api/membership/roster", { cookie: volunteer }))).status, 403);
    const organizer = await loginCookie(DEMO.organizer);
    const roster = await rosterRoute(apiRequest("/api/membership/roster", { cookie: organizer }));
    assert.equal(roster.status, 200);
    const body = await roster.json();
    assert.deepEqual(body.counts, { active: 2, expired: 0, never: 5 });
    assert.equal((await rosterRoute(apiRequest("/api/membership/roster?state=bogus", { cookie: organizer }))).status, 400);
    const neverPaid = await (await rosterRoute(apiRequest("/api/membership/roster?state=never", { cookie: organizer }))).json();
    assert.equal(neverPaid.roster.length, 5);
  });
});
