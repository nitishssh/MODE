import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GET as eventDetailRoute } from "../src/app/api/events/[id]/route";
import { POST as guestRoute } from "../src/app/api/events/[id]/guest-tickets/route";
import { GET as reportRoute } from "../src/app/api/events/[id]/report/route";
import { POST as scanRoute } from "../src/app/api/events/[id]/scan/route";
import { POST as bookRoute } from "../src/app/api/events/[id]/tickets/route";
import { GET as eventsRoute, POST as createEventRoute } from "../src/app/api/events/route";
import { POST as cancelRoute } from "../src/app/api/tickets/[id]/cancel/route";
import { POST as confirmRoute } from "../src/app/api/tickets/[id]/confirm/route";
import { GET as mineRoute } from "../src/app/api/tickets/mine/route";
import { GET as publicTicketRoute } from "../src/app/t/[token]/route";
import { openClubDatabase } from "../src/lib/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../src/lib/errors";
import { DOOR_MESSAGES, HOLD_MS } from "../src/lib/modules/events";
import { DEMO, FIXED_NOW, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

const ACTIVE = "active@example.com";
const EXPIRED = "expired@example.com";
const EVENT = { title: "Winter gala", startsAt: "2026-11-01T13:30:00.000Z", venue: "Main hall", capacity: 5, memberPricePaise: 5000, guestPricePaise: 10000 };

test("booking fixes price from membership state, allows one live ticket per member or guest email, and guests get a /t link", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const event = db.events.createEvent(organizer, EVENT);
    assert.deepEqual([event.status, event.available, event.registered], ["published", 5, 0]);
    assert.throws(() => db.events.createEvent(actorFor(db, DEMO.volunteer), EVENT), ForbiddenError);

    const member = db.events.bookTicket(actorFor(db, ACTIVE), event.id);
    assert.deepEqual([member.pricing, member.pricePaise, member.status], ["member", 5000, "pending_payment"]);
    assert.equal(member.holdExpiresAt, new Date(FIXED_NOW.getTime() + HOLD_MS).toISOString());
    assert.match(member.qrToken!, /^[A-Za-z0-9_-]{22}$/);
    assert.equal(member.shortCode.length, 10);

    const lapsed = db.events.bookTicket(actorFor(db, EXPIRED), event.id);
    assert.deepEqual([lapsed.pricing, lapsed.pricePaise], ["guest", 10000], "expired membership pays the guest price");
    assert.throws(() => db.events.bookTicket(actorFor(db, ACTIVE), event.id), (e: unknown) => e instanceof ConflictError && e.code === "duplicate_ticket");

    const guest = db.events.bookGuestTicket(organizer.clubId, event.id, { name: "Guest One", email: "Guest.One@Example.com" });
    assert.deepEqual([guest.pricing, guest.pricePaise, guest.memberId, guest.holderName], ["guest", 10000, null, "Guest One"]);
    assert.equal(guest.guestEmail, "g***@example.com", "holder view masks the email");
    assert.throws(() => db.events.bookGuestTicket(organizer.clubId, event.id, { name: "Again", email: "guest.one@example.com" }), (e: unknown) => e instanceof ConflictError && e.code === "duplicate_ticket");
    assert.throws(() => db.events.bookGuestTicket(organizer.clubId, event.id, { name: "Sneaky", email: ACTIVE }), (e: unknown) => e instanceof ConflictError && e.code === "member_email");

    const view = db.events.publicTicket(guest.qrToken!);
    assert.deepEqual([view.holderName, view.status, view.event.title, view.shortCode], ["Guest One", "pending_payment", "Winter gala", guest.shortCode]);
    assert.throws(() => db.events.publicTicket(guest.id), NotFoundError, "ids never resolve a ticket");
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 2);

    const draft = db.events.createEvent(organizer, { ...EVENT, title: "Draft night", status: "draft" });
    assert.throws(() => db.events.bookTicket(actorFor(db, ACTIVE), draft.id), (e: unknown) => e instanceof ConflictError && e.code === "event_not_open");
    assert.throws(() => db.events.getEvent(null, organizer.clubId, draft.id), NotFoundError, "drafts hidden from the public");
    assert.equal(db.events.listEvents(organizer.clubId).some((e) => e.id === draft.id), false);
    assert.equal(db.events.listEvents(organizer.clubId, { includeUnpublished: true }).some((e) => e.id === draft.id), true);

    const free = db.events.createEvent(organizer, { ...EVENT, title: "Free meetup", memberPricePaise: 0, guestPricePaise: 0 });
    const freeTicket = db.events.bookTicket(actorFor(db, ACTIVE), free.id);
    assert.deepEqual([freeTicket.status, freeTicket.holdExpiresAt], ["paid", null], "free seats are paid at booking, no ledger row");
  } finally {
    db.close();
  }
});

test("the last seat cannot be oversold across two connections and capacity cannot drop below held seats", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-seat-race-"));
  const path = join(directory, "race.sqlite");
  const a = openClubDatabase(path, { now: () => new Date(FIXED_NOW) });
  const b = openClubDatabase(path, { now: () => new Date(FIXED_NOW) });
  try {
    const organizer = actorFor(a, DEMO.organizer);
    const event = a.events.createEvent(organizer, { ...EVENT, capacity: 1 });
    const first = a.events.bookTicket(actorFor(a, ACTIVE), event.id);
    assert.equal(first.status, "pending_payment");
    assert.throws(() => b.events.bookTicket(actorFor(b, EXPIRED), event.id), (e: unknown) => e instanceof ConflictError && e.code === "sold_out");
    assert.equal(b.events.requireEvent(organizer.clubId, event.id).registered, 1);
    assert.throws(() => a.events.updateEvent(organizer, event.id, { capacity: 0 }), /Capacity cannot drop/);
    const bigger = a.events.updateEvent(organizer, event.id, { capacity: 2 });
    assert.equal(bigger.available, 1);
    assert.equal(b.events.bookTicket(actorFor(b, EXPIRED), event.id).status, "pending_payment");
  } finally {
    a.close();
    b.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("holds expire after 30 minutes and return the seat once; stale confirmation writes no income; duplicates are idempotent", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const event = db.events.createEvent(organizer, { ...EVENT, capacity: 2 });
    const before = db.ledger.balance();

    const stale = db.events.bookTicket(actorFor(db, ACTIVE), event.id);
    assert.throws(() => db.events.confirmTicket(actorFor(db, DEMO.volunteer), stale.id, { reference: "CASH-1" }), ForbiddenError);
    clock.now = new Date(FIXED_NOW.getTime() + HOLD_MS - 1);
    assert.equal(db.events.pendingHolds(treasurer, event.id).length, 1, "still held one millisecond before expiry");
    clock.now = new Date(FIXED_NOW.getTime() + HOLD_MS);
    assert.deepEqual(db.events.pendingHolds(treasurer, event.id), [], "released at the boundary");
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 2, "seat returned");
    assert.throws(() => db.events.confirmTicket(treasurer, stale.id, { reference: "CASH-1" }), (e: unknown) => e instanceof ConflictError && e.code === "hold_expired" && e.message === "Hold expired, rebook");
    assert.equal(db.ledger.balance(), before, "no income for an expired hold");
    assert.equal(db.events.myTickets(actorFor(db, ACTIVE)).find((t) => t.id === stale.id)?.status, "expired");

    // Rebooking after expiry gets a fresh hold and a fresh token.
    const fresh = db.events.bookTicket(actorFor(db, ACTIVE), event.id);
    assert.notEqual(fresh.id, stale.id);
    assert.notEqual(fresh.qrToken, stale.qrToken);
    const confirmed = db.events.confirmTicket(treasurer, fresh.id, { reference: "CASH-2" });
    assert.deepEqual([confirmed.created, confirmed.ticket.status, confirmed.ticket.confirmedBy, confirmed.ticket.paymentReference], [true, "paid", treasurer.memberId, "CASH-2"]);
    assert.equal(db.ledger.balance(), before + 5000);
    const entry = db.ledger.list().find((e) => e.sourceType === "ticket" && e.sourceId === fresh.id)!;
    assert.deepEqual([entry.kind, entry.amountPaise, entry.recordedBy], ["income", 5000, treasurer.memberId]);

    const again = db.events.confirmTicket(organizer, fresh.id, { reference: "CASH-3" });
    assert.deepEqual([again.created, again.ticket.paymentReference], [false, "CASH-2"], "duplicate confirmation returns the original, posts nothing");
    assert.equal(db.ledger.balance(), before + 5000);
    assert.equal(db.ledger.list().filter((e) => e.sourceId === fresh.id).length, 1);
    assert.throws(() => db.events.cancelTicket(organizer, fresh.id), (e: unknown) => e instanceof ConflictError && e.code === "refunds_out_of_scope");

    // Cancellation: owner for their own pending hold, officer for anyone; repeat is a no-op; seat returned exactly once.
    const other = db.events.bookTicket(actorFor(db, EXPIRED), event.id);
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 0);
    assert.throws(() => db.events.cancelTicket(actorFor(db, DEMO.volunteer), other.id), ForbiddenError);
    assert.equal(db.events.cancelTicket(actorFor(db, EXPIRED), other.id).status, "cancelled");
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 1);
    assert.equal(db.events.cancelTicket(actorFor(db, EXPIRED), other.id).status, "cancelled");
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).available, 1, "repeat cancellation does not return a second seat");
    assert.throws(() => db.events.confirmTicket(treasurer, other.id, { reference: "CASH-4" }), (e: unknown) => e instanceof ConflictError && e.code === "hold_expired");
    const rebooked = db.events.bookTicket(actorFor(db, EXPIRED), event.id);
    assert.equal(db.events.cancelTicket(treasurer, rebooked.id).status, "cancelled", "officer cancels a pending hold");
    assert.throws(() => db.events.releaseExpiredHolds(), /inside a transaction/);
  } finally {
    db.close();
  }
});

test("the door table: every scan outcome, repeat scans never admit twice, and the report counts attendance and revenue", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const volunteer = actorFor(db, DEMO.volunteer);
    const gala = db.events.createEvent(organizer, EVENT);
    const other = db.events.createEvent(organizer, { ...EVENT, title: "Other night" });

    const paid = db.events.bookTicket(actorFor(db, ACTIVE), gala.id);
    db.events.confirmTicket(organizer, paid.id, { reference: "UPI-A" });
    const pending = db.events.bookTicket(actorFor(db, EXPIRED), gala.id);
    const guest = db.events.bookGuestTicket(organizer.clubId, gala.id, { name: "Door Guest", email: "door@example.com" });
    db.events.confirmTicket(organizer, guest.id, { reference: "UPI-G" });
    const otherTicket = db.events.bookTicket(actorFor(db, ACTIVE), other.id);
    db.events.confirmTicket(organizer, otherTicket.id, { reference: "UPI-O" });

    assert.throws(() => db.events.scan(actorFor(db, DEMO.treasurer), gala.id, { credential: paid.shortCode }), ForbiddenError);
    assert.throws(() => db.events.scan(volunteer, "no-such-event", { credential: paid.shortCode }), NotFoundError, "event must be selected first");

    // Paid, unscanned ticket by typed code (lower case, hyphenated).
    const typed = `${paid.shortCode.slice(0, 5)}-${paid.shortCode.slice(5)}`.toLowerCase();
    const admitted = db.events.scan(volunteer, gala.id, { credential: typed });
    assert.deepEqual([admitted.outcome, admitted.message, admitted.admitted, admitted.attendee], ["admitted", "Admitted", true, { name: "Active Member Demo", membership: "active" }]);
    assert.equal(admitted.checkedInAt, FIXED_NOW.toISOString());

    // Repeat by ticket token, then by the member's own pass: same original timestamp, never admitted again.
    clock.now = new Date(FIXED_NOW.getTime() + 60_000);
    const repeat = db.events.scan(volunteer, gala.id, { credential: paid.qrToken! });
    assert.deepEqual([repeat.outcome, repeat.message, repeat.admitted, repeat.checkedInAt], ["already_checked_in", "Already checked in", false, FIXED_NOW.toISOString()]);
    const viaMember = db.events.scan(volunteer, gala.id, { credential: db.getPass(paid.memberId!).qrToken });
    assert.equal(viaMember.outcome, "already_checked_in");

    // Pending ticket via the member's short code resolves to their single live ticket.
    const pendingScan = db.events.scan(volunteer, gala.id, { credential: db.getPass(pending.memberId!).shortCode });
    assert.deepEqual([pendingScan.outcome, pendingScan.message, pendingScan.ticketId], ["payment_pending", "Payment pending", pending.id]);

    // Guest ticket at the wrong event, unknown credential, and a ticket id (never a credential).
    assert.equal(db.events.scan(volunteer, other.id, { credential: guest.shortCode }).message, "Not valid for this event");
    assert.equal(db.events.scan(volunteer, gala.id, { credential: "ZZZZZZZZZZ" }).outcome, "not_valid");
    assert.equal(db.events.scan(volunteer, gala.id, { credential: guest.id }).outcome, "not_valid");
    const guestScan = db.events.scan(volunteer, gala.id, { credential: guest.qrToken! });
    assert.deepEqual([guestScan.outcome, guestScan.attendee], ["admitted", { name: "Door Guest", membership: "guest" }]);

    // Members without a ticket: active vs expired vs never paid.
    const rohan = db.getMembers().find((m) => m.email === "rohan@example.com")!;
    assert.equal(rohan.membership, "active");
    assert.deepEqual(db.events.scan(volunteer, gala.id, { credential: rohan.shortCode }).message, "Member, no ticket");
    const expiredMember = db.getMembers().find((m) => m.email === EXPIRED)!;
    assert.equal(db.events.scan(volunteer, other.id, { credential: expiredMember.shortCode }).message, "No ticket · membership expired");
    const never = db.createMember({ name: "Never Paid", email: "never@example.com" });
    assert.equal(db.events.scan(volunteer, gala.id, { credential: never.shortCode }).outcome, "no_ticket_membership_expired");
    assert.equal(Object.keys(DOOR_MESSAGES).length, 6);

    // Admission depends on the paid ticket, not on membership: expire the member, their paid ticket at `other` still admits.
    clock.now = new Date("2029-01-01T08:00:00.000Z");
    const expiredEvent = db.events.createEvent(organizer, { ...EVENT, title: "Far future", startsAt: "2029-02-01T10:00:00.000Z" });
    const futureTicket = db.events.bookTicket(actorFor(db, ACTIVE), expiredEvent.id);
    assert.equal(futureTicket.pricing, "guest", "membership lapsed by 2029");
    db.events.confirmTicket(organizer, futureTicket.id, { reference: "UPI-F" });
    const lateAdmit = db.events.scan(volunteer, expiredEvent.id, { credential: futureTicket.shortCode });
    assert.deepEqual([lateAdmit.outcome, lateAdmit.attendee?.membership], ["admitted", "expired"]);

    clock.now = new Date(FIXED_NOW.getTime() + 120_000);
    const report = db.events.eventReport(organizer, gala.id);
    assert.deepEqual(report.tickets, { pendingPayment: 1, paid: 2, cancelled: 0, expired: 0 });
    assert.deepEqual([report.ticketsSold, report.attendance, report.realizedRevenuePaise], [2, 2, 15000]);
    assert.throws(() => db.events.eventReport(volunteer, gala.id), ForbiddenError);
    const everything = db.events.eventTickets(organizer, gala.id);
    assert.equal(everything.length, 3);
    assert.equal(everything.find((t) => t.id === guest.id)?.guestEmail, "door@example.com", "officers see the full guest email");
  } finally {
    db.close();
  }
});

test("ticket routes: permissions, same-origin guest booking, 201/200 confirmation, scan, public ticket link", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const volunteer = await loginCookie(DEMO.volunteer);
    const active = await loginCookie(ACTIVE);

    assert.equal((await createEventRoute(apiRequest("/api/events", { body: EVENT, cookie: volunteer }))).status, 403);
    const created = await createEventRoute(apiRequest("/api/events", { body: EVENT, cookie: organizer }));
    assert.equal(created.status, 201);
    const event = (await created.json()).event;
    assert.equal((await createEventRoute(apiRequest("/api/events", { body: { ...EVENT, capacity: -1 }, cookie: organizer }))).status, 400);

    const listed = await (await eventsRoute(apiRequest("/api/events"))).json();
    assert.ok(listed.events.some((e: { id: string }) => e.id === event.id), "public list shows the published event");
    assert.equal((await eventDetailRoute(apiRequest(`/api/events/${event.id}`), routeParams({ id: event.id }))).status, 200);

    assert.equal((await bookRoute(apiRequest(`/api/events/${event.id}/tickets`, { method: "POST" }), routeParams({ id: event.id }))).status, 401);
    const booked = await bookRoute(apiRequest(`/api/events/${event.id}/tickets`, { method: "POST", cookie: active }), routeParams({ id: event.id }));
    assert.equal(booked.status, 201);
    const ticket = (await booked.json()).ticket;
    assert.deepEqual([ticket.pricing, ticket.pricePaise], ["member", 5000]);
    assert.equal((await bookRoute(apiRequest(`/api/events/${event.id}/tickets`, { method: "POST", cookie: active }), routeParams({ id: event.id }))).status, 409);

    const guestBody = { name: "Route Guest", email: "route.guest@example.com" };
    assert.equal((await guestRoute(apiRequest(`/api/events/${event.id}/guest-tickets`, { body: guestBody, origin: "http://evil.example" }), routeParams({ id: event.id }))).status, 403);
    const guest = await guestRoute(apiRequest(`/api/events/${event.id}/guest-tickets`, { body: guestBody }), routeParams({ id: event.id }));
    assert.equal(guest.status, 201);
    const guestJson = await guest.json();
    assert.equal(guestJson.url, `/t/${guestJson.ticket.qrToken}`);
    const publicView = await publicTicketRoute(apiRequest(guestJson.url), routeParams({ token: guestJson.ticket.qrToken }));
    assert.equal(publicView.status, 200);
    assert.equal((await publicView.json()).ticket.holderName, "Route Guest");
    assert.equal((await publicTicketRoute(apiRequest("/t/nope"), routeParams({ token: "nope" }))).status, 404);

    const confirmBody = { reference: "ROUTE-1" };
    assert.equal((await confirmRoute(apiRequest(`/api/tickets/${ticket.id}/confirm`, { body: confirmBody, cookie: volunteer }), routeParams({ id: ticket.id }))).status, 403);
    assert.equal((await confirmRoute(apiRequest(`/api/tickets/${ticket.id}/confirm`, { body: confirmBody, cookie: organizer }), routeParams({ id: ticket.id }))).status, 201);
    assert.equal((await confirmRoute(apiRequest(`/api/tickets/${ticket.id}/confirm`, { body: confirmBody, cookie: organizer }), routeParams({ id: ticket.id }))).status, 200);
    assert.equal((await cancelRoute(apiRequest(`/api/tickets/${guestJson.ticket.id}/cancel`, { method: "POST", cookie: volunteer }), routeParams({ id: guestJson.ticket.id }))).status, 403);
    assert.equal((await cancelRoute(apiRequest(`/api/tickets/${guestJson.ticket.id}/cancel`, { method: "POST", cookie: organizer }), routeParams({ id: guestJson.ticket.id }))).status, 200);

    const mine = await (await mineRoute(apiRequest("/api/tickets/mine", { cookie: active }))).json();
    assert.equal(mine.tickets[0].status, "paid");
    assert.ok(mine.tickets[0].qrToken, "owner sees their QR token");

    const scan = await scanRoute(apiRequest(`/api/events/${event.id}/scan`, { body: { credential: ticket.shortCode }, cookie: volunteer }), routeParams({ id: event.id }));
    assert.equal(scan.status, 200);
    assert.equal((await scan.json()).message, "Admitted");
    assert.equal((await (await scanRoute(apiRequest(`/api/events/${event.id}/scan`, { body: { credential: ticket.shortCode }, cookie: volunteer }), routeParams({ id: event.id }))).json()).message, "Already checked in");
    assert.equal((await scanRoute(apiRequest(`/api/events/${event.id}/scan`, { body: { credential: ticket.shortCode }, cookie: active }), routeParams({ id: event.id }))).status, 403);

    assert.equal((await reportRoute(apiRequest(`/api/events/${event.id}/report`, { cookie: volunteer }), routeParams({ id: event.id }))).status, 403);
    const report = await (await reportRoute(apiRequest(`/api/events/${event.id}/report`, { cookie: organizer }), routeParams({ id: event.id }))).json();
    assert.deepEqual([report.ticketsSold, report.attendance, report.realizedRevenuePaise, report.tickets.cancelled], [1, 1, 5000, 1]);
  });
});
