import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { POST as approveRoute } from "../src/app/api/expenses/[id]/approve/route";
import { POST as payRoute } from "../src/app/api/expenses/[id]/pay/route";
import { GET as listExpensesRoute, POST as submitRoute } from "../src/app/api/expenses/route";
import { GET as exportRoute } from "../src/app/api/ledger/export/route";
import { GET as summaryRoute } from "../src/app/api/ledger/summary/route";
import { GET as downloadRoute } from "../src/app/api/receipts/[id]/route";
import { POST as uploadRoute } from "../src/app/api/receipts/route";
import { openClubDatabase } from "../src/lib/database";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import type { Actor } from "../src/lib/modules/identity";
import { RECEIPT_MAX_BYTES } from "../src/lib/modules/treasury";
import { DEMO, FIXED_NOW, ORIGIN, actorFor, apiRequest, loginCookie, routeParams, withRouteDatabase } from "./helpers";

function treasuryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "mode-treasury-"));
  const clock = { now: new Date(FIXED_NOW) };
  const db = openClubDatabase(":memory:", { now: () => new Date(clock.now), receiptDirectory: join(directory, "receipts") });
  return { db, clock, cleanup: () => { db.close(); rmSync(directory, { recursive: true, force: true }); } };
}

function memberActor(db: ReturnType<typeof openClubDatabase>, email: string): Actor {
  db.createMemberWithCredentials({ name: `Member ${email}`, email, password: "member-pass-123", role: "member" });
  return actorFor(db, email, "member-pass-123");
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test("expense lifecycle: submitted, approved and paid are distinct and only payout moves cash", () => {
  const { db, cleanup } = treasuryDatabase();
  try {
    const volunteer = actorFor(db, DEMO.volunteer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const organizer = actorFor(db, DEMO.organizer);
    const start = db.treasury.summary(treasurer);
    assert.equal(start.balancePaise, 185000);
    assert.equal(start.inflowPaise - start.outflowPaise, start.balancePaise);

    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: -500, purpose: "Negative", receiptReference: "RCPT-NEG" }), ValidationError);
    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: 0, purpose: "Zero amount", receiptReference: "RCPT-0" }), ValidationError);
    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: 1500, purpose: "No receipt at all" }), ValidationError);
    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: 1500, purpose: "Bad event", receiptReference: "R", eventId: "missing" }), ValidationError);
    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: 1500, purpose: "Bad event", receiptReference: "RCPT-E", eventId: "missing" }), NotFoundError);

    const expense = db.treasury.submitExpense(volunteer, { amountPaise: 45000, purpose: "Banner printing", receiptReference: "RCPT-1001", eventId: "demo-event-2" });
    assert.equal(expense.status, "submitted");
    assert.equal(db.treasury.summary(treasurer).balancePaise, 185000, "submission does not move cash");

    assert.throws(() => db.treasury.decide(volunteer, expense.id, "approved"), ForbiddenError, "volunteers cannot approve");
    assert.throws(() => db.treasury.decide(organizer, expense.id, "approved"), ForbiddenError, "organizers cannot approve");
    assert.throws(() => db.treasury.markPaid(treasurer, expense.id, "PAYOUT-1"), (error: unknown) => error instanceof ConflictError && error.code === "expense_not_approved");

    const approved = db.treasury.decide(treasurer, expense.id, "approved", "Looks right");
    assert.equal(approved.status, "approved");
    assert.equal(approved.reviewedBy, treasurer.memberId);
    assert.equal(db.treasury.summary(treasurer).balancePaise, 185000, "approval does not move cash");
    assert.equal(db.treasury.summary(treasurer).approvedUnpaidPaise, 45000);
    assert.throws(() => db.treasury.decide(treasurer, expense.id, "rejected"), (error: unknown) => error instanceof ConflictError && error.code === "expense_not_pending");

    const paid = db.treasury.markPaid(treasurer, expense.id, "PAYOUT-1");
    assert.equal(paid.created, true);
    assert.equal(paid.expense.status, "paid");
    const after = db.treasury.summary(treasurer);
    assert.equal(after.balancePaise, 185000 - 45000);
    assert.equal(after.approvedUnpaidPaise, 0);
    assert.equal(after.byEvent.find((row) => row.eventId === "demo-event-2")?.outflowPaise, 45000);

    const replay = db.treasury.markPaid(treasurer, expense.id, "PAYOUT-1");
    assert.equal(replay.created, false);
    assert.equal(db.treasury.summary(treasurer).balancePaise, 140000, "duplicate payout entry is not written twice");
    assert.throws(() => db.treasury.markPaid(treasurer, expense.id, "PAYOUT-2"), (error: unknown) => error instanceof ConflictError && error.code === "already_paid");

    const other = db.treasury.submitExpense(volunteer, { amountPaise: 1000, purpose: "Tape", receiptReference: "RCPT-1002" });
    db.treasury.decide(treasurer, other.id, "approved");
    assert.throws(() => db.treasury.markPaid(treasurer, other.id, "PAYOUT-1"), (error: unknown) => error instanceof ConflictError && error.code === "payment_reference_reused");
    assert.throws(() => db.ledger.postEntry({ clubId: treasurer.clubId, kind: "expense", category: "reimbursement", amountPaise: 1, description: "dup", source: { type: "expense_request", id: expense.id } }), ConflictError);

    const audit = db.listAudit(actorFor(db, DEMO.admin), "expense_request");
    assert.deepEqual(audit.map((item) => item.action).slice(0, 4), ["expense.approved", "expense.submitted", "expense.paid", "expense.approved"]);
    assert.equal(db.treasury.listExpenses(volunteer).length, 2);
    assert.equal(db.treasury.listExpenses(memberActor(db, "stranger@example.com")).length, 0, "members only see their own requests");
    assert.equal(db.treasury.listExpenses(treasurer, { status: "paid" }).length, 1);
  } finally {
    cleanup();
  }
});

test("reviewers cannot approve their own requests and rejections carry a note", () => {
  const { db, cleanup } = treasuryDatabase();
  try {
    const treasurer = actorFor(db, DEMO.treasurer);
    const admin = actorFor(db, DEMO.admin);
    const own = db.treasury.submitExpense(treasurer, { amountPaise: 2000, purpose: "Treasurer's own taxi", receiptReference: "RCPT-T1" });
    assert.throws(() => db.treasury.decide(treasurer, own.id, "approved"), ForbiddenError);
    const rejected = db.treasury.decide(admin, own.id, "rejected", "Not a club expense");
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.decisionNote, "Not a club expense");
    assert.throws(() => db.treasury.markPaid(admin, own.id, "X-1"), ConflictError);
  } finally {
    cleanup();
  }
});

test("ledger reconciliation: balance equals the sum of entries across every income source and reimbursements", () => {
  const { db, cleanup } = treasuryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const buyer = memberActor(db, "recon@example.com");
    db.membership.recordDues(organizer, { memberId: buyer.memberId, planId: "plan-annual", paymentReference: "D-1", amountPaise: 50000 });
    const event = db.events.createEvent(organizer, { title: "Recon night", description: "", startsAt: "2026-11-01T12:00:00.000Z", venue: "Hall", capacity: 5, memberPricePaise: 5000, guestPricePaise: 9000, status: "published" });
    const booking = db.events.bookEvent(buyer, event.id);
    db.events.confirmBooking(organizer, booking.id, { paymentReference: "T-1", amountPaise: 5000 });
    const variant = db.merchandise.requireProduct(organizer.clubId, "demo-product-2").variants[0];
    const order = db.merchandise.createOrder(buyer, { variantId: variant.id, quantity: 1 });
    db.merchandise.confirmOrder(treasurer, order.id, { paymentReference: "M-1", amountPaise: 29900 });
    const expense = db.treasury.submitExpense(buyer, { amountPaise: 12000, purpose: "Snacks", receiptReference: "RCPT-S", eventId: event.id });
    db.treasury.decide(treasurer, expense.id, "approved");
    db.treasury.markPaid(treasurer, expense.id, "PAYOUT-S");

    const summary = db.treasury.summary(treasurer);
    const entries = db.treasury.listEntries(treasurer);
    const computed = entries.reduce((sum, entry) => sum + (entry.kind === "income" ? entry.amountPaise : -entry.amountPaise), 0);
    assert.equal(summary.balancePaise, computed);
    assert.equal(summary.balancePaise, 185000 + 50000 + 5000 + 29900 - 12000);
    assert.deepEqual(summary.byEvent.find((row) => row.eventId === event.id), { eventId: event.id, title: "Recon night", inflowPaise: 5000, outflowPaise: 12000, netPaise: -7000 });
    assert.equal(summary.byCategory.find((row) => row.category === "membership")?.inflowPaise, 100000 + 50000);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, summary.balancePaise, "dashboard and ledger agree");
    assert.equal(db.treasury.listEntries(treasurer, { eventId: event.id }).length, 2);
    assert.equal(db.treasury.summary(organizer).balancePaise, summary.balancePaise, "organizers may read totals");
    assert.throws(() => db.treasury.summary(buyer), ForbiddenError, "plain members may not");
    assert.throws(() => db.treasury.listEntries(organizer), ForbiddenError, "line items stay treasurer-only");

    const csv = db.treasury.exportCsv(treasurer);
    assert.match(csv.split("\n")[0], /^id,occurredAt,kind,category,amountPaise/);
    assert.equal(csv.trim().split("\n").length - 1, entries.length);
  } finally {
    cleanup();
  }
});

test("receipt uploads enforce type and size limits and are readable only by uploader or reviewer", () => {
  const { db, cleanup } = treasuryDatabase();
  try {
    const volunteer = actorFor(db, DEMO.volunteer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const stranger = memberActor(db, "nosy@example.com");
    assert.throws(() => db.treasury.storeReceipt(volunteer, { name: "x.exe", type: "application/x-msdownload", bytes: PNG }), (error: unknown) => error instanceof DomainError && error.status === 415);
    assert.throws(() => db.treasury.storeReceipt(volunteer, { name: "big.png", type: "image/png", bytes: new Uint8Array(RECEIPT_MAX_BYTES + 1) }), (error: unknown) => error instanceof DomainError && error.status === 413);
    assert.throws(() => db.treasury.storeReceipt(volunteer, { name: "empty.png", type: "image/png", bytes: new Uint8Array(0) }), ValidationError);

    const receipt = db.treasury.storeReceipt(volunteer, { name: '../../evil"name.png', type: "image/png", bytes: PNG });
    assert.equal(receipt.sizeBytes, PNG.byteLength);
    assert.ok(!receipt.originalName.includes("/") && !receipt.originalName.includes('"'));
    assert.deepEqual(new Uint8Array(db.treasury.readReceipt(volunteer, receipt.id).bytes), PNG);
    assert.equal(db.treasury.readReceipt(treasurer, receipt.id).receipt.id, receipt.id);
    assert.throws(() => db.treasury.readReceipt(stranger, receipt.id), ForbiddenError);
    assert.throws(() => db.treasury.readReceipt(volunteer, "missing"), NotFoundError);

    assert.throws(() => db.treasury.submitExpense(stranger, { amountPaise: 100, purpose: "Not my receipt", receiptId: receipt.id }), ForbiddenError);
    const first = db.treasury.submitExpense(volunteer, { amountPaise: 100, purpose: "Markers", receiptId: receipt.id });
    assert.equal(first.receiptId, receipt.id);
    assert.throws(() => db.treasury.submitExpense(volunteer, { amountPaise: 100, purpose: "Same receipt again", receiptId: receipt.id }), (error: unknown) => error instanceof ConflictError && error.code === "duplicate_receipt");
  } finally {
    cleanup();
  }
});

test("treasury routes enforce permissions, accept multipart receipts and return CSV", async () => {
  await withRouteDatabase(async () => {
    const volunteer = await loginCookie(DEMO.volunteer);
    const treasurer = await loginCookie(DEMO.treasurer);

    const form = new FormData();
    form.set("file", new File([PNG], "receipt.png", { type: "image/png" }));
    const upload = await uploadRoute(new Request(`${ORIGIN}/api/receipts`, { method: "POST", headers: { Origin: ORIGIN, Cookie: volunteer }, body: form }));
    assert.equal(upload.status, 201);
    const receiptId = (await upload.json()).receipt.id as string;
    assert.equal((await uploadRoute(new Request(`${ORIGIN}/api/receipts`, { method: "POST", headers: { Origin: ORIGIN, Cookie: volunteer, "Content-Type": "application/json" }, body: "{}" }))).status, 400);

    const download = await downloadRoute(apiRequest(`/api/receipts/${receiptId}`, { cookie: volunteer }), routeParams({ id: receiptId }));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-type"), "image/png");
    assert.equal((await downloadRoute(apiRequest(`/api/receipts/${receiptId}`), routeParams({ id: receiptId }))).status, 401);

    assert.equal((await submitRoute(apiRequest("/api/expenses", { body: { amountPaise: -1, purpose: "Negative", receiptId }, cookie: volunteer }))).status, 400);
    const submitted = await submitRoute(apiRequest("/api/expenses", { body: { amountPaise: 2500, purpose: "Stickers", receiptId }, cookie: volunteer }));
    assert.equal(submitted.status, 201);
    const expenseId = (await submitted.json()).expense.id as string;

    assert.equal((await approveRoute(apiRequest(`/api/expenses/${expenseId}/approve`, { method: "POST", cookie: volunteer }), routeParams({ id: expenseId }))).status, 403);
    assert.equal((await payRoute(apiRequest(`/api/expenses/${expenseId}/pay`, { body: { paymentReference: "RT-1" }, cookie: treasurer }), routeParams({ id: expenseId }))).status, 409);
    assert.equal((await approveRoute(apiRequest(`/api/expenses/${expenseId}/approve`, { body: { note: "ok" }, cookie: treasurer }), routeParams({ id: expenseId }))).status, 200);
    assert.equal((await payRoute(apiRequest(`/api/expenses/${expenseId}/pay`, { body: { paymentReference: "RT-1" }, cookie: treasurer }), routeParams({ id: expenseId }))).status, 201);
    assert.equal((await payRoute(apiRequest(`/api/expenses/${expenseId}/pay`, { body: { paymentReference: "RT-1" }, cookie: treasurer }), routeParams({ id: expenseId }))).status, 200);

    assert.equal((await summaryRoute(apiRequest("/api/ledger/summary", { cookie: volunteer }))).status, 200, "volunteers see totals");
    const summary = await summaryRoute(apiRequest("/api/ledger/summary", { cookie: treasurer }));
    assert.equal(summary.status, 200);
    assert.equal((await summary.json()).summary.balancePaise, 185000 - 2500);
    const csv = await exportRoute(apiRequest("/api/ledger/export", { cookie: treasurer }));
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    assert.equal((await (await listExpensesRoute(apiRequest("/api/expenses", { cookie: volunteer }))).json()).expenses.length, 1);
  });
});
