import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as confirmRoute } from "../src/app/api/bookings/[id]/confirm/route";
import { POST as bookRoute } from "../src/app/api/events/[id]/bookings/route";
import { GET as reportRoute } from "../src/app/api/events/[id]/report/route";
import { GET as listEvents, POST as createEventRoute } from "../src/app/api/events/route";
import { POST as checkInRoute } from "../src/app/api/tickets/[code]/check-in/route";
import { PLAN_ANNUAL_ID } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { RESERVATION_HOLD_MS } from "../src/lib/modules/events";
import type { Actor } from "../src/lib/modules/identity";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

type Db = ReturnType<typeof memoryDatabase>["db"];

function memberActor(db: Db, email: string): Actor {
  db.createMemberWithCredentials({ name: `Member ${email}`, email, password: "member-pass-123", role: "member" });
  return actorFor(db, email, "member-pass-123");
}

function sampleEvent(db: Db, organizer: Actor, overrides: Partial<Parameters<Db["events"]["createEvent"]>[1]> = {}) {
  return db.events.createEvent(organizer, {
    title: "Tech talk",
    description: "",
    startsAt: "2026-10-20T12:30:00.000Z",
    venue: "Hall 1",
    capacity: 2,
    memberPricePaise: 5000,
    guestPricePaise: 10000,
    status: "published",
    ...overrides,
  });
}

test("member pricing follows the membership rule, including after expiry", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const event = sampleEvent(db, organizer, { capacity: 10 });
    const paid = memberActor(db, "paid@example.com");
    const guest = memberActor(db, "guest@example.com");
    db.membership.recordDues(organizer, { memberId: paid.memberId, planId: PLAN_ANNUAL_ID, paymentReference: "EV-1", amountPaise: 50000 });

    const memberBooking = db.events.bookEvent(paid, event.id);
    assert.deepEqual([memberBooking.pricing, memberBooking.pricePaise, memberBooking.status, memberBooking.ticketCode], ["member", 5000, "reserved", null]);
    const guestBooking = db.events.bookEvent(guest, event.id);
    assert.deepEqual([guestBooking.pricing, guestBooking.pricePaise], ["guest", 10000]);
    assert.throws(() => db.events.bookEvent(paid, event.id), (error: unknown) => error instanceof ConflictError && error.code === "duplicate_booking");

    // An expired member books a later event at guest price.
    clock.now = new Date("2027-11-01T08:00:00.000Z");
    const later = sampleEvent(db, organizer, { startsAt: "2027-12-01T12:00:00.000Z", capacity: 10 });
    assert.equal(db.events.bookEvent(paid, later.id).pricing, "guest");
  } finally {
    db.close();
  }
});

test("the last seat cannot be sold twice and cancelling releases it", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const event = sampleEvent(db, organizer, { capacity: 1 });
    const first = memberActor(db, "first@example.com");
    const second = memberActor(db, "second@example.com");
    const booking = db.events.bookEvent(first, event.id);
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 0);
    assert.throws(() => db.events.bookEvent(second, event.id), (error: unknown) => error instanceof ConflictError && error.code === "sold_out");

    assert.throws(() => db.events.cancelBooking(second, booking.id), ForbiddenError, "only the owner or an organizer may cancel");
    db.events.cancelBooking(first, booking.id);
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 1);
    assert.equal(db.events.bookEvent(second, event.id).status, "reserved");
    assert.throws(() => db.events.updateEvent(organizer, event.id, { capacity: 0 }), ValidationError, "capacity cannot drop below held seats");
    const draft = sampleEvent(db, organizer, { status: "draft", description: "Keep me" });
    const renamed = db.events.updateEvent(organizer, draft.id, { title: "Renamed draft" });
    assert.deepEqual([renamed.status, renamed.description], ["draft", "Keep me"], "omitted fields are not reset by a partial update");
  } finally {
    db.close();
  }
});

test("lapsed reservations release their seat and cannot be confirmed afterwards", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const event = sampleEvent(db, organizer, { capacity: 1 });
    const slow = memberActor(db, "slow@example.com");
    const quick = memberActor(db, "quick@example.com");
    const held = db.events.bookEvent(slow, event.id);
    clock.now = new Date(clock.now.getTime() + RESERVATION_HOLD_MS + 1000);
    const taken = db.events.bookEvent(quick, event.id);
    assert.equal(taken.status, "reserved");
    assert.equal(db.events.requireBooking(organizer.clubId, held.id).status, "expired");
    assert.throws(
      () => db.events.confirmBooking(organizer, held.id, { paymentReference: "LATE-1", amountPaise: 10000 }),
      (error: unknown) => error instanceof ConflictError && error.code === "reservation_not_active",
    );
  } finally {
    db.close();
  }
});

test("payment confirmation issues one ticket, posts one ledger row and tolerates duplicate confirmations", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const event = sampleEvent(db, organizer, { capacity: 5 });
    const attendee = memberActor(db, "attendee@example.com");
    const booking = db.events.bookEvent(attendee, event.id);
    const before = db.getDashboard(treasurer).metrics.balancePaise;

    assert.throws(() => db.events.confirmBooking(attendee, booking.id, { paymentReference: "PAY-1", amountPaise: 10000 }), ForbiddenError);
    assert.throws(() => db.events.confirmBooking(treasurer, booking.id, { paymentReference: "PAY-1", amountPaise: 9999 }), ValidationError);
    const confirmed = db.events.confirmBooking(treasurer, booking.id, { paymentReference: "PAY-1", amountPaise: 10000 });
    assert.equal(confirmed.created, true);
    assert.match(confirmed.booking.ticketCode ?? "", /^MODE-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 10000);

    const replay = db.events.confirmBooking(treasurer, booking.id, { paymentReference: "PAY-1", amountPaise: 10000 });
    assert.equal(replay.created, false);
    assert.equal(replay.booking.ticketCode, confirmed.booking.ticketCode);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 10000, "no double credit");
    assert.throws(
      () => db.events.confirmBooking(treasurer, booking.id, { paymentReference: "PAY-2", amountPaise: 10000 }),
      (error: unknown) => error instanceof ConflictError && error.code === "already_confirmed",
    );
    const other = db.events.bookEvent(memberActor(db, "other@example.com"), event.id);
    assert.throws(
      () => db.events.confirmBooking(treasurer, other.id, { paymentReference: "PAY-1", amountPaise: 10000 }),
      (error: unknown) => error instanceof ConflictError && error.code === "payment_reference_reused",
    );

    const report = db.events.eventReport(organizer, event.id);
    assert.equal(report.incomePaise, 10000);
    assert.equal(report.netPaise, 10000);
    assert.equal(report.fundraiser, null, "ordinary event has no goal");
    assert.deepEqual(report.bookings, { reserved: 1, confirmed: 1, cancelled: 0, expired: 0 });
    assert.equal(report.attendees.length, 1);
  } finally {
    db.close();
  }
});

test("check-in accepts a valid ticket once and rejects invalid, cancelled and repeated scans", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const volunteer = actorFor(db, DEMO.volunteer);
    const event = sampleEvent(db, organizer, { capacity: 5, memberPricePaise: 0, guestPricePaise: 0 });
    const attendee = memberActor(db, "scan@example.com");
    const free = db.events.bookEvent(attendee, event.id);
    assert.equal(free.status, "confirmed", "free seats confirm immediately");
    assert.ok(free.ticketCode);

    assert.throws(() => db.events.checkIn(attendee, free.ticketCode!), ForbiddenError);
    assert.throws(() => db.events.checkIn(volunteer, "MODE-NOPE-NOPE"), NotFoundError);
    const scanned = db.events.checkIn(volunteer, free.ticketCode!.toLowerCase());
    assert.equal(scanned.attendee.id, attendee.memberId);
    assert.throws(
      () => db.events.checkIn(volunteer, free.ticketCode!),
      (error: unknown) => error instanceof ConflictError && error.code === "already_checked_in",
    );
    assert.throws(() => db.events.cancelBooking(attendee, free.id), ConflictError, "used tickets cannot be cancelled");

    const cancelled = db.events.bookEvent(memberActor(db, "cancel@example.com"), event.id);
    db.events.cancelBooking(organizer, cancelled.id);
    assert.throws(
      () => db.events.checkIn(volunteer, cancelled.ticketCode!),
      (error: unknown) => error instanceof ConflictError && error.code === "ticket_not_valid",
    );
    assert.equal(db.events.eventReport(organizer, event.id).checkedIn, 1);
  } finally {
    db.close();
  }
});

test("concurrent booking requests through the route never oversell", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const created = await createEventRoute(
      apiRequest("/api/events", {
        body: { title: "Capacity test", startsAt: "2026-10-25T10:00:00.000Z", venue: "Lawn", capacity: 2, memberPricePaise: 0, guestPricePaise: 0 },
        cookie: organizer,
      }),
    );
    assert.equal(created.status, 201);
    const eventId = (await created.json()).event.id;

    const { POST: register } = await import("../src/app/api/auth/register/route");
    const cookies: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await register(apiRequest("/api/auth/register", { body: { name: `Racer ${i}`, email: `racer${i}@example.com`, password: "racer-pass-123" } }));
      cookies.push(`mode_session=${/mode_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")![1]}`);
    }
    const results = await Promise.all(cookies.map((cookie) => bookRoute(apiRequest(`/api/events/${eventId}/bookings`, { method: "POST", cookie }), routeParams({ id: eventId }))));
    const statuses = results.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 201, 409, 409, 409]);

    const anonymous = await bookRoute(apiRequest(`/api/events/${eventId}/bookings`, { method: "POST" }), routeParams({ id: eventId }));
    assert.equal(anonymous.status, 401);
    const report = await reportRoute(apiRequest(`/api/events/${eventId}/report`, { cookie: organizer }), routeParams({ id: eventId }));
    assert.equal((await report.json()).report.event.available, 0);
    assert.equal((await reportRoute(apiRequest(`/api/events/${eventId}/report`, { cookie: cookies[0] }), routeParams({ id: eventId }))).status, 403);

    const publicList = await (await listEvents(apiRequest("/api/events"))).json();
    assert.ok(publicList.events.some((event: { id: string }) => event.id === eventId));

    const ticket = (await results[0].json()).booking.ticketCode as string;
    const volunteer = await loginCookie(DEMO.volunteer);
    assert.equal((await checkInRoute(apiRequest(`/api/tickets/${ticket}/check-in`, { method: "POST", cookie: volunteer }), routeParams({ code: ticket }))).status, 200);
    assert.equal((await checkInRoute(apiRequest(`/api/tickets/${ticket}/check-in`, { method: "POST", cookie: volunteer }), routeParams({ code: ticket }))).status, 409);
    assert.equal((await confirmRoute(apiRequest(`/api/bookings/x/confirm`, { body: { paymentReference: "ABC-1", amountPaise: 1 }, cookie: volunteer }), routeParams({ id: "x" }))).status, 403);
  });
});
