import assert from "node:assert/strict";
import { PRIVACY_POLICY_VERSION } from "../src/lib/contracts";
import { test } from "node:test";
import { getDatabase } from "../src/lib/database";
import { demoPassword } from "../src/lib/db/migrations";
import type { ExpenseLedgerEntry } from "../src/lib/contracts";
import { apiRequest, cookieFrom, DEMO, ORIGIN, routeParams, withRouteDatabase } from "./helpers";
import { POST as register } from "../src/app/api/auth/register/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { GET as me } from "../src/app/api/auth/me/route";
import { POST as dues } from "../src/app/api/membership/dues/route";
import { POST as createEvent } from "../src/app/api/events/route";
import { POST as book } from "../src/app/api/events/[id]/tickets/route";
import { POST as confirmTicket } from "../src/app/api/tickets/[id]/confirm/route";
import { POST as scan } from "../src/app/api/events/[id]/scan/route";
import { POST as createProduct } from "../src/app/api/products/route";
import { POST as orderProduct } from "../src/app/api/orders/route";
import { POST as confirmOrder } from "../src/app/api/orders/[id]/confirm/route";
import { POST as publish } from "../src/app/api/announcements/route";
import { GET as outbox } from "../src/app/api/announcements/[id]/outbox/route";
import { GET as notifications } from "../src/app/api/notifications/route";
import { POST as createTask } from "../src/app/api/tasks/route";
import { POST as moveTask } from "../src/app/api/tasks/[id]/status/route";
import { POST as upload } from "../src/app/api/receipts/route";
import { GET as receipt } from "../src/app/api/receipts/[id]/route";
import { POST as submitExpense } from "../src/app/api/expenses/route";
import { POST as expenseAction } from "../src/app/api/expenses/[id]/[action]/route";
import { GET as entries } from "../src/app/api/ledger/entries/route";
import { GET as summary } from "../src/app/api/ledger/summary/route";
import { GET as source } from "../src/app/api/ledger/entries/[id]/source/route";

async function body(response: Response, status = 200) {
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}

// Value: protects the same new member's state across every module and both auth
// transports; independent module fixtures cannot catch broken handoffs between
// registration, dues, prices, audience and reimbursement. No production seam.
test("fresh semester journey carries identity, permissions and exactly-once money across real routes", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const baseline = db.ledger.reconcile();
    const issued = await register(apiRequest("/api/auth/register", { body: {
      name: "Journey Member", email: "journey@example.com", password: "journey-test-only-123",
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    } }));
    const memberCookie = cookieFrom(issued);
    const member = await body(issued, 201);
    assert.equal(member.user.role, "member");
    const memberAuth = { authorization: `Bearer ${member.token}`, origin: null };
    const officers = await Promise.all([DEMO.organizer, DEMO.treasurer, DEMO.volunteer, DEMO.admin].map(async email => {
      const response = await login(apiRequest("/api/auth/login", { body: { email, password: demoPassword() } }));
      const cookie = cookieFrom(response);
      return { cookie, ...await body(response) };
    }));
    const [organizer, treasurer, volunteer, admin] = officers;
    const org = { cookie: organizer.cookie }, finance = { cookie: treasurer.cookie };
    const volunteerAuth = { authorization: `Bearer ${volunteer.token}`, origin: null };
    const beforePass = await body(await me(apiRequest("/api/auth/me", memberAuth)));
    assert.equal(beforePass.pass.membership, "none");

    const expected: { sourceType: string; sourceId: string; amountPaise: number; kind: string; recordedBy: string }[] = [];
    async function money() {
      const rows: ExpenseLedgerEntry[] = await body(await entries(apiRequest("/api/ledger/entries", finance)));
      const realized = rows.filter(row => row.sourceType !== "opening_balance");
      assert.equal(realized.length, expected.length, "only realized journey sources post money");
      for (const want of expected) {
        const matching = realized.filter(row => row.sourceType === want.sourceType && row.sourceId === want.sourceId);
        assert.equal(matching.length, 1, "one ledger row per realized source");
        for (const key of ["amountPaise", "kind", "recordedBy"] as const) assert.equal(matching[0][key], want[key]);
        const linked = await body(await source(apiRequest(`/api/ledger/entries/${matching[0].id}/source`, finance), routeParams({ id: matching[0].id })));
        assert.equal(linked.id, want.sourceId);
      }
      const incoming = expected.filter(row => row.kind === "income").reduce((sum, row) => sum + row.amountPaise, 0);
      const outgoing = expected.filter(row => row.kind === "expense").reduce((sum, row) => sum + row.amountPaise, 0);
      const report = db.ledger.reconcile();
      assert.deepEqual([report.orphans, report.duplicates, report.missing, report.mismatched], [[], [], [], []]);
      assert.equal(report.unsourced, 0);
      assert.equal(report.balancePaise, baseline.balancePaise + incoming - outgoing);
      const totals = await body(await summary(apiRequest("/api/ledger/summary", finance)));
      assert.equal(totals.balancePaise, baseline.balancePaise + incoming - outgoing);
      assert.equal(totals.inflowPaise - totals.outflowPaise, totals.balancePaise);
    }

    const duesBody = { memberId: member.user.id, reference: "JOURNEY-DUES" };
    await body(await dues(apiRequest("/api/membership/dues", { ...memberAuth, body: duesBody })), 403);
    await money();
    const payment = await body(await dues(apiRequest("/api/membership/dues", { ...finance, body: duesBody })), 201);
    expected.push({ sourceType: "dues_payment", sourceId: payment.payment.id, amountPaise: payment.payment.amountPaise, kind: "income", recordedBy: treasurer.user.id });
    assert.equal(payment.membership, "active");
    await money();
    assert.equal((await body(await dues(apiRequest("/api/membership/dues", { ...finance, body: duesBody })))).payment.id, payment.payment.id);
    assert.equal((await body(await me(apiRequest("/api/auth/me", { cookie: memberCookie })))).pass.membership, "active");
    await money();

    const event = (await body(await createEvent(apiRequest("/api/events", { ...org, body: {
      title: "Journey meetup", venue: "Synthetic hall", startsAt: "2026-11-01T13:30:00Z", capacity: 4, memberPricePaise: 1200, guestPricePaise: 2400,
    } })), 201)).event;
    const ticket = (await body(await book(apiRequest(`/api/events/${event.id}/tickets`, { ...memberAuth, method: "POST" }), routeParams({ id: event.id })), 201)).ticket;
    assert.deepEqual([ticket.pricing, ticket.pricePaise, ticket.status], ["member", 1200, "pending_payment"]);
    await money();
    const ticketPay = (auth = finance) => confirmTicket(apiRequest(`/api/tickets/${ticket.id}/confirm`, { ...auth, body: { reference: "JOURNEY-TICKET" } }), routeParams({ id: ticket.id }));
    await body(await ticketPay({ cookie: memberCookie }), 403);
    await money();
    await body(await ticketPay(), 201);
    expected.push({ sourceType: "ticket", sourceId: ticket.id, amountPaise: 1200, kind: "income", recordedBy: treasurer.user.id });
    await body(await ticketPay());
    await money();
    const scanTicket = () => scan(apiRequest(`/api/events/${event.id}/scan`, { ...volunteerAuth, body: { credential: ticket.shortCode } }), routeParams({ id: event.id }));
    assert.equal((await body(await scanTicket())).message, "Admitted");
    assert.equal((await body(await scanTicket())).message, "Already checked in");

    const product = (await body(await createProduct(apiRequest("/api/products", { ...org, body: {
      name: "Journey shirt", pricePaise: 2000, memberPricePaise: 1500, variants: [{ size: "M", stock: 3 }],
    } })), 201)).product;
    const order = (await body(await orderProduct(apiRequest("/api/orders", { ...memberAuth, body: { variantId: product.variants[0].id } })), 201)).order;
    assert.deepEqual([order.pricing, order.totalPaise, order.status], ["member", 1500, "pending_payment"]);
    await money();
    const orderPay = () => confirmOrder(apiRequest(`/api/orders/${order.id}/confirm`, { ...finance, body: { reference: "JOURNEY-ORDER" } }), routeParams({ id: order.id }));
    await body(await orderPay(), 201);
    expected.push({ sourceType: "merch_order", sourceId: order.id, amountPaise: 1500, kind: "income", recordedBy: treasurer.user.id });
    await body(await orderPay());
    await money();

    const announcementBody = { title: "Journey notice", body: "Synthetic member announcement", idempotencyKey: "journey-notice" };
    await body(await publish(apiRequest("/api/announcements", { ...memberAuth, body: announcementBody })), 403);
    const publication = await body(await publish(apiRequest("/api/announcements", { ...org, body: announcementBody })), 201);
    const inbox = () => notifications(apiRequest("/api/notifications", memberAuth));
    assert.equal((await body(await inbox())).notifications.filter((row: { announcementId: string }) => row.announcementId === publication.announcement.id).length, 1);
    const beforeOutbox = await body(await outbox(apiRequest("/api/announcements/id/outbox", org), routeParams({ id: publication.announcement.id })));
    assert.ok(beforeOutbox.messages.some((row: { memberId: string }) => row.memberId === member.user.id));
    await body(await outbox(apiRequest("/api/announcements/id/outbox", memberAuth), routeParams({ id: publication.announcement.id })), 403);
    await body(await publish(apiRequest("/api/announcements", { ...org, body: announcementBody })));
    assert.deepEqual(await body(await outbox(apiRequest("/api/announcements/id/outbox", org), routeParams({ id: publication.announcement.id }))), beforeOutbox);
    assert.equal((await body(await inbox())).notifications.filter((row: { announcementId: string }) => row.announcementId === publication.announcement.id).length, 1);

    const task = await body(await createTask(apiRequest("/api/tasks", { ...org, body: { title: "Journey volunteer desk", assigneeId: volunteer.user.id, eventId: event.id } })), 201);
    const move = (auth: typeof memberAuth) => moveTask(apiRequest(`/api/tasks/${task.id}/status`, { ...auth, body: { status: "done" } }), routeParams({ id: task.id }));
    await body(await move(memberAuth), 403);
    assert.equal((await body(await move(volunteerAuth))).status, "done");

    const bytes = Buffer.from("%PDF-1.4 synthetic journey receipt");
    const form = new FormData();
    form.set("file", new File([bytes], "receipt.pdf", { type: "application/pdf" }));
    const uploaded = await body(await upload(new Request(`${ORIGIN}/api/receipts`, { method: "POST", headers: { Authorization: memberAuth.authorization }, body: form })), 201);
    const expense = await body(await submitExpense(apiRequest("/api/expenses", { ...memberAuth, body: { amountPaise: 700, purpose: "Journey supplies", receiptId: uploaded.id, eventId: event.id } })), 201);
    await money();
    await body(await expenseAction(apiRequest("/api/expenses/id/approve", { ...memberAuth, body: {} }), routeParams({ id: expense.id, action: "approve" })), 403);
    await body(await expenseAction(apiRequest("/api/expenses/id/approve", { ...finance, body: {} }), routeParams({ id: expense.id, action: "approve" })));
    await money();
    const payExpense = () => expenseAction(apiRequest("/api/expenses/id/pay", { cookie: admin.cookie, body: { paymentReference: "JOURNEY-EXPENSE" } }), routeParams({ id: expense.id, action: "pay" }));
    assert.equal((await body(await payExpense())).status, "paid");
    expected.push({ sourceType: "expense", sourceId: expense.id, amountPaise: 700, kind: "expense", recordedBy: admin.user.id });
    await body(await payExpense());
    await money();
    await body(await receipt(apiRequest("/api/receipts/id", volunteerAuth), routeParams({ id: uploaded.id })), 403);
    const downloaded = await receipt(apiRequest("/api/receipts/id", memberAuth), routeParams({ id: uploaded.id }));
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);

    // The same membership must stop granting prices/audience after expiry;
    // old paid records and publication snapshots must remain unchanged.
    process.env.MODE_DEMO_NOW = "2027-10-12T08:00:00.000Z";
    await body(await me(apiRequest("/api/auth/me", memberAuth)), 401);
    const renewedSession = await body(await login(apiRequest("/api/auth/login", { body: { email: "journey@example.com", password: "journey-test-only-123" } })));
    const expiredAuth = { authorization: `Bearer ${renewedSession.token}`, origin: null };
    assert.equal((await body(await me(apiRequest("/api/auth/me", expiredAuth)))).pass.membership, "expired");
    const freshOrg = await login(apiRequest("/api/auth/login", { body: { email: DEMO.organizer, password: demoPassword() } }));
    org.cookie = cookieFrom(freshOrg);
    await body(freshOrg);
    const freshFinance = await login(apiRequest("/api/auth/login", { body: { email: DEMO.treasurer, password: demoPassword() } }));
    finance.cookie = cookieFrom(freshFinance);
    await body(freshFinance);
    const nextEvent = (await body(await createEvent(apiRequest("/api/events", { ...org, body: {
      title: "Next year meetup", venue: "Synthetic hall", startsAt: "2027-11-01T13:30:00Z", capacity: 3, memberPricePaise: 1200, guestPricePaise: 2400,
    } })), 201)).event;
    const expiredTicket = (await body(await book(apiRequest(`/api/events/${nextEvent.id}/tickets`, { ...expiredAuth, method: "POST" }), routeParams({ id: nextEvent.id })), 201)).ticket;
    assert.deepEqual([expiredTicket.pricing, expiredTicket.pricePaise], ["guest", 2400]);
    const expiredOrder = (await body(await orderProduct(apiRequest("/api/orders", { ...expiredAuth, body: { variantId: product.variants[0].id } })), 201)).order;
    assert.deepEqual([expiredOrder.pricing, expiredOrder.totalPaise], ["standard", 2000]);
    const nextPublication = await body(await publish(apiRequest("/api/announcements", { ...org, body: { ...announcementBody, idempotencyKey: "journey-next-year" } })), 201);
    const expiredInbox = (await body(await notifications(apiRequest("/api/notifications", expiredAuth)))).notifications;
    assert.ok(!expiredInbox.some((row: { announcementId: string }) => row.announcementId === nextPublication.announcement.id));
    assert.equal(expiredInbox.filter((row: { announcementId: string }) => row.announcementId === publication.announcement.id).length, 1);
    await body(await publish(apiRequest("/api/announcements", { ...org, body: announcementBody })));
    assert.deepEqual(await body(await outbox(apiRequest("/api/announcements/id/outbox", org), routeParams({ id: publication.announcement.id }))), beforeOutbox);
    await money();
  });
});
