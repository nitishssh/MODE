import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as passwordRoute } from "../src/app/api/auth/password/route";
import { SQLITE_CONSTRAINT_FOREIGNKEY, isConstraintError } from "../src/lib/db/core";
import { demoPassword } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, TooManyAttemptsError, UnauthorizedError, ValidationError } from "../src/lib/errors";
import { HOLD_MS, maxPendingGuestHolds } from "../src/lib/modules/events";
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_FAILURES } from "../src/lib/modules/identity";
import { MAX_PENDING_UNITS_PER_MEMBER } from "../src/lib/modules/merchandise";
import { DEMO, FIXED_NOW, actorFor, apiRequest, loginCookie, memoryDatabase, receiptFor, withRouteDatabase } from "./helpers";
import { getDatabase } from "../src/lib/database";

/** Each test here closes one finding from docs/DB-AUDIT.md; the number is in the title. */

test("#1 cancelled or draft events admit nobody and cancelling releases pending holds", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer), treasurer = actorFor(db, DEMO.treasurer), volunteer = actorFor(db, DEMO.volunteer);
    const event = db.events.createEvent(organizer, { title: "Cancelled gala", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 5, memberPricePaise: 1000, guestPricePaise: 2000 });
    const paid = db.events.bookTicket(actorFor(db, "active@example.com"), event.id);
    db.events.confirmTicket(treasurer, paid.id, { reference: "GALA-1" });
    db.events.bookGuestTicket(organizer.clubId, event.id, { name: "Pending", email: "pending@example.com" });
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).registered, 2);
    assert.equal(db.events.scan(volunteer, event.id, { credential: paid.shortCode }).outcome, "admitted");

    db.events.updateEvent(organizer, event.id, { status: "cancelled" });
    assert.equal(db.events.requireEvent(organizer.clubId, event.id).registered, 1, "the unpaid hold was released, the paid ticket stays on record");
    assert.equal(db.events.eventTickets(treasurer, event.id).find((t) => t.memberId === null)?.status, "cancelled");
    assert.equal(db.events.scan(volunteer, event.id, { credential: paid.shortCode }).outcome, "not_valid", "a cancelled event admits nobody");

    const draft = db.events.createEvent(organizer, { title: "Draft", venue: "Hall", startsAt: "2026-11-02T13:30:00Z", capacity: 5, memberPricePaise: 0, guestPricePaise: 0, status: "draft" });
    assert.equal(db.events.scan(volunteer, draft.id, { credential: paid.shortCode }).outcome, "not_valid");
    assert.ok(db.listAudit(actorFor(db, DEMO.admin), "event").some((a) => a.entityId === event.id && a.details?.releasedHolds === 1));
  } finally { db.close(); }
});

test("#2 one receipt backs one live claim; rejection frees it; the index backs the check", () => {
  const { db } = memoryDatabase();
  try {
    const member = actorFor(db, "active@example.com"), treasurer = actorFor(db, DEMO.treasurer);
    const receiptId = receiptFor(db, member);
    const first = db.submitExpense(member, { amountPaise: 100, purpose: "First claim", receiptId });
    assert.throws(() => db.submitExpense(member, { amountPaise: 100, purpose: "Second claim", receiptId }), (e: unknown) => e instanceof ConflictError && e.code === "receipt_already_claimed");
    db.approveExpense(treasurer, first.id);
    db.payExpense(treasurer, first.id, "PAID-1");
    assert.throws(() => db.submitExpense(member, { amountPaise: 100, purpose: "After payment", receiptId }), ConflictError, "a paid claim keeps its receipt");
    const second = db.submitExpense(member, { amountPaise: 50, purpose: "To reject", receiptId: receiptFor(db, member) });
    db.rejectExpense(treasurer, second.id, "No");
    assert.equal(db.submitExpense(member, { amountPaise: 60, purpose: "Reuse after rejection", receiptId: second.receiptId! }).status, "submitted");
  } finally { db.close(); }
});

test("#3/#4 a payment reference settles one ticket, one order or one claim; a replay must repeat the same reference", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), member = actorFor(db, "active@example.com"), other = actorFor(db, "expired@example.com");
    const event = db.events.createEvent(admin, { title: "Refs", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 5, memberPricePaise: 1000, guestPricePaise: 2000 });
    const a = db.events.bookTicket(member, event.id), b = db.events.bookTicket(other, event.id);
    db.events.confirmTicket(admin, a.id, { reference: "UPI-SAME" });
    assert.throws(() => db.events.confirmTicket(admin, b.id, { reference: "UPI-SAME" }), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_reused");
    assert.equal(db.events.confirmTicket(admin, a.id, { reference: "UPI-SAME" }).created, false);
    assert.throws(() => db.events.confirmTicket(admin, a.id, { reference: "UPI-OTHER" }), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_mismatch");
    assert.equal(db.events.eventTickets(admin, event.id).find((t) => t.id === b.id)?.status, "pending_payment", "the rejected confirmation changed nothing");

    const product = db.merchandise.createProduct(admin, { name: "Cap", pricePaise: 500, variants: [{ size: "M", stock: 5 }] });
    const o1 = db.merchandise.createOrder(member, { variantId: product.variants[0].id }), o2 = db.merchandise.createOrder(other, { variantId: product.variants[0].id });
    db.merchandise.confirmOrder(admin, o1.id, { reference: "ORD-SAME" });
    assert.throws(() => db.merchandise.confirmOrder(admin, o2.id, { reference: "ORD-SAME" }), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_reused");
    assert.throws(() => db.merchandise.confirmOrder(admin, o1.id, { reference: "ORD-OTHER" }), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_mismatch");

    const e1 = db.submitExpense(member, { amountPaise: 100, purpose: "Claim one", receiptId: receiptFor(db, member) });
    const e2 = db.submitExpense(member, { amountPaise: 100, purpose: "Claim two", receiptId: receiptFor(db, member) });
    db.approveExpense(admin, e1.id); db.approveExpense(admin, e2.id);
    db.payExpense(admin, e1.id, "NEFT-SAME");
    assert.throws(() => db.payExpense(admin, e2.id, "NEFT-SAME"), (e: unknown) => e instanceof ConflictError && e.code === "payment_reference_reused");
    assert.equal(db.getExpenseById(admin, e2.id).status, "approved");
    const report = db.ledger.reconcile();
    assert.deepEqual([report.duplicates, report.missing, report.mismatched], [[], [], []]);
  } finally { db.close(); }
});

test("#5 inventory reconciliation is clean after real flows and accounts for the starter's seeded registrations", () => {
  const { db, clock } = memoryDatabase();
  try {
    assert.deepEqual(db.ledger.reconcileInventory(), { events: [], products: [] }, "seeded registrations are recorded, not reported as drift");
    const admin = actorFor(db, DEMO.admin), member = actorFor(db, "active@example.com");
    const event = db.events.createEvent(admin, { title: "Inventory", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 3, memberPricePaise: 100, guestPricePaise: 200 });
    const paid = db.events.bookTicket(member, event.id);
    db.events.confirmTicket(admin, paid.id, { reference: "INV-1" });
    db.events.bookGuestTicket(admin.clubId, event.id, { name: "Lapsing", email: "lapse@example.com" });
    const product = db.merchandise.createProduct(admin, { name: "Shirt", pricePaise: 100, variants: [{ size: "S", stock: 2 }, { size: "M", stock: 3 }] });
    const order = db.merchandise.createOrder(member, { variantId: product.variants[0].id, quantity: 2 });
    assert.deepEqual(db.ledger.reconcileInventory(), { events: [], products: [] });
    clock.now = new Date(FIXED_NOW.getTime() + HOLD_MS);
    db.events.myTickets(member); db.merchandise.myOrders(member); // reads release lapsed holds without a write transaction of their own
    assert.equal(db.events.requireEvent(admin.clubId, event.id).registered, 1);
    assert.equal(db.merchandise.requireProduct(admin.clubId, product.id).stock, 5);
    assert.equal(db.merchandise.myOrders(member).find((o) => o.id === order.id)?.status, "expired");
    assert.deepEqual(db.ledger.reconcileInventory(), { events: [], products: [] });
  } finally { db.close(); }
});

test("#6/#7 club foreign keys are enforced and a ledger row never defaults to the sample club", () => {
  const { db } = memoryDatabase();
  try {
    const officer = db.getMembers().find((m) => m.email === DEMO.treasurer)!;
    assert.throws(() => db.createMember({ name: "Ghost", email: "ghost@example.com" }, { clubId: "club-does-not-exist" }), (e: unknown) => isConstraintError(e, SQLITE_CONSTRAINT_FOREIGNKEY));
    assert.throws(
      () => db.transaction(() => db.ledger.post({ kind: "income", amountPaise: 100, description: "no club", source: { type: "test", id: "x" }, recordedBy: officer.id } as never)),
      ValidationError,
    );
    assert.throws(
      () => db.transaction(() => db.ledger.post({ clubId: "club-does-not-exist", kind: "income", amountPaise: 100, description: "bad club", source: { type: "test", id: "y" }, recordedBy: officer.id })),
      (e: unknown) => isConstraintError(e, SQLITE_CONSTRAINT_FOREIGNKEY),
    );
    assert.throws(() => db.ledger.list(""), ValidationError);
  } finally { db.close(); }
});

test("#8/#9 password set by an admin signs the member out everywhere; self-service change keeps only the current session", async () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    const member = db.createMemberWithCredentials({ name: "Pw Member", email: "pw@example.com", password: "first-password-1", role: "member" });
    const s1 = db.login({ email: "pw@example.com", password: "first-password-1" }).token;
    const s2 = db.login({ email: "pw@example.com", password: "first-password-1" }).token;
    db.setPassword(admin, member.id, "admin-reset-pass-2");
    assert.equal(db.getActor(s1), null); assert.equal(db.getActor(s2), null);
    assert.throws(() => db.login({ email: "pw@example.com", password: "first-password-1" }), UnauthorizedError);

    const s3 = db.login({ email: "pw@example.com", password: "admin-reset-pass-2" }).token;
    const s4 = db.login({ email: "pw@example.com", password: "admin-reset-pass-2" }).token;
    const actor = db.getActor(s3)!;
    assert.throws(() => db.changePassword(actor, { currentPassword: "wrong", newPassword: "self-chosen-pass-3" }), UnauthorizedError);
    assert.throws(() => db.changePassword(actor, { currentPassword: "admin-reset-pass-2", newPassword: "short" }));
    assert.deepEqual(db.changePassword(actor, { currentPassword: "admin-reset-pass-2", newPassword: "self-chosen-pass-3" }), { revokedSessions: 1 });
    assert.ok(db.getActor(s3), "the session that changed the password survives");
    assert.equal(db.getActor(s4), null, "every other session is revoked");
    assert.ok(db.login({ email: "pw@example.com", password: "self-chosen-pass-3" }).token);
  } finally { db.close(); }

  await withRouteDatabase(async () => {
    const cookie = await loginCookie(DEMO.volunteer);
    const bad = await passwordRoute(apiRequest("/api/auth/password", { cookie, body: { currentPassword: "nope", newPassword: "volunteer-new-pass-1" } }));
    assert.equal(bad.status, 401);
    const ok = await passwordRoute(apiRequest("/api/auth/password", { cookie, body: { currentPassword: demoPassword(), newPassword: "volunteer-new-pass-1" } }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, revokedSessions: 0 });
    assert.ok(getDatabase().login({ email: DEMO.volunteer, password: "volunteer-new-pass-1" }).token);
  });
});

test("#10 repeated failed sign-ins lock the email for the window, then clear on success", () => {
  const { db, clock } = memoryDatabase();
  try {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i += 1) assert.throws(() => db.login({ email: DEMO.organizer, password: "wrong" }), UnauthorizedError);
    assert.throws(() => db.login({ email: DEMO.organizer, password: demoPassword() }), (e: unknown) => e instanceof TooManyAttemptsError && e.status === 429, "even the right password is refused while locked");
    assert.throws(() => db.login({ email: "nobody@example.com", password: "x" }), UnauthorizedError, "unknown emails count but do not reveal themselves");
    clock.now = new Date(FIXED_NOW.getTime() + LOGIN_LOCKOUT_MS + 1);
    assert.ok(db.login({ email: DEMO.organizer, password: demoPassword() }).token, "the lock expires");
    assert.throws(() => db.login({ email: DEMO.organizer, password: "wrong" }), UnauthorizedError);
    assert.ok(db.login({ email: DEMO.organizer, password: demoPassword() }).token, "a success resets the counter");
  } finally { db.close(); }
});

test("#11/#21 anonymous guest holds are capped per event; a member's unpaid units are capped in total", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), member = actorFor(db, "active@example.com");
    const event = db.events.createEvent(admin, { title: "Hold spam", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 50, memberPricePaise: 100, guestPricePaise: 200 });
    const cap = maxPendingGuestHolds(50);
    assert.equal(cap, 5);
    for (let i = 0; i < cap; i += 1) db.events.bookGuestTicket(admin.clubId, event.id, { name: `Guest ${i}`, email: `guest${i}@example.com` });
    assert.throws(() => db.events.bookGuestTicket(admin.clubId, event.id, { name: "One more", email: "more@example.com" }), (e: unknown) => e instanceof ConflictError && e.code === "guest_holds_full");
    assert.equal(db.events.requireEvent(admin.clubId, event.id).available, 50 - cap, "most seats stay available to members and paying guests");
    assert.ok(db.events.bookTicket(member, event.id).id, "members are not subject to the guest cap");

    const product = db.merchandise.createProduct(admin, { name: "Many sizes", pricePaise: 100, variants: ["XS", "S", "M", "L"].map((size) => ({ size, stock: 10 })) });
    for (const variant of product.variants.slice(0, MAX_PENDING_UNITS_PER_MEMBER / 2)) db.merchandise.createOrder(member, { variantId: variant.id, quantity: 2 });
    assert.throws(() => db.merchandise.createOrder(member, { variantId: product.variants[3].id, quantity: 1 }), (e: unknown) => e instanceof ConflictError && e.code === "pending_limit");
  } finally { db.close(); }
});

test("#12 purge removes expired and revoked sessions, stale login counters and old simulated outbox rows", () => {
  const { db, clock } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    db.logout(db.login({ email: DEMO.organizer, password: demoPassword() }).token);
    assert.throws(() => db.login({ email: DEMO.treasurer, password: "wrong" }), UnauthorizedError);
    db.announcements.publish(admin, { idempotencyKey: "old", title: "Old news", body: "Will be purged" });
    assert.deepEqual(db.purge(), { sessions: 1, loginAttempts: 0, outbox: 0 }, "only the revoked session is old enough");
    clock.now = new Date(FIXED_NOW.getTime() + 8 * 86_400_000);
    const purged = db.purge();
    assert.ok(purged.sessions >= 1, "the admin's own 7-day session has expired");
    assert.equal(purged.loginAttempts, 1);
    assert.equal(purged.outbox, 0);
    clock.now = new Date(FIXED_NOW.getTime() + 91 * 86_400_000);
    assert.equal(db.purge().outbox, 3, "simulated announcement deliveries older than the retention window are gone");
    assert.equal(db.getActor(admin.sessionId), null);
  } finally { db.close(); }
});

test("#14 separation of duties is a club policy: once enabled, the approving officer cannot also pay", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin), treasurer = actorFor(db, DEMO.treasurer), member = actorFor(db, "active@example.com");
    const first = db.submitExpense(member, { amountPaise: 100, purpose: "Policy off", receiptId: receiptFor(db, member) });
    db.approveExpense(treasurer, first.id);
    assert.equal(db.payExpense(treasurer, first.id, "POL-1").status, "paid", "default policy allows a single treasurer to do both");
    assert.throws(() => db.setRequireSeparatePayer(treasurer, true), ForbiddenError);
    db.setRequireSeparatePayer(admin, true);
    const second = db.submitExpense(member, { amountPaise: 100, purpose: "Policy on", receiptId: receiptFor(db, member) });
    db.approveExpense(treasurer, second.id);
    assert.throws(() => db.payExpense(treasurer, second.id, "POL-2"), ForbiddenError);
    assert.equal(db.payExpense(admin, second.id, "POL-2").status, "paid", "a different officer may pay");
  } finally { db.close(); }
});

test("#15 member passes never collide with ticket passes", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    const event = db.events.createEvent(admin, { title: "Codes", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 5, memberPricePaise: 0, guestPricePaise: 0 });
    const ticket = db.events.bookGuestTicket(admin.clubId, event.id, { name: "Guest", email: "codes@example.com" }, admin);
    const member = db.createMember({ name: "Fresh", email: "fresh@example.com" });
    assert.notEqual(member.shortCode, ticket.shortCode);
    assert.equal(db.findMemberByPass(admin.clubId, ticket.shortCode), null, "a ticket code never resolves to a member");
  } finally { db.close(); }
});
