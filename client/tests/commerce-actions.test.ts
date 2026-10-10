import assert from "node:assert/strict";
import { test } from "node:test";
import type { MerchOrder, Role, SessionUser } from "../src/generated/contracts";
import { canCreateProduct, canInspectOutbox, canPublishAnnouncement, canReserveMerchandise, canViewOfficerOrders, orderActions, orderStatusLabel } from "../src/lib/commerce-actions";

function user(id: string, role: Role, permissions: string[]): SessionUser {
  return { id, role, permissions, clubId: "club-1", name: role, email: `${role}@example.com` };
}

const member = user("member-1", "member", ["orders:create"]);
const volunteer = user("volunteer-1", "volunteer", ["orders:create", "tickets:check_in"]);
const treasurer = user("treasurer-1", "treasurer", ["orders:create", "payments:confirm", "ledger:read"]);
const organizer = user("organizer-1", "organizer", ["orders:create", "payments:confirm", "orders:fulfil", "products:write", "announcements:write", "outbox:manage"]);

function order(status: MerchOrder["status"], memberId = member.id): MerchOrder {
  return {
    id: `order-${status}`, memberId, memberName: "Synthetic member", productId: "product-1", productName: "MODE Tee", variantId: "variant-m", size: "M", quantity: 1,
    unitPricePaise: 2500, totalPaise: 2500, pricing: "member", status,
    holdExpiresAt: status === "pending_payment" ? "2026-10-11T12:30:00.000Z" : null,
    paidAt: status === "paid" || status === "fulfilled" ? "2026-10-11T12:10:00.000Z" : null,
    paymentReference: status === "paid" || status === "fulfilled" ? "SYNTHETIC-1" : null,
    confirmedBy: status === "paid" || status === "fulfilled" ? treasurer.id : null,
    fulfilledAt: status === "fulfilled" ? "2026-10-11T12:20:00.000Z" : null,
    fulfilledBy: status === "fulfilled" ? organizer.id : null,
    createdAt: "2026-10-11T12:00:00.000Z", updatedAt: "2026-10-11T12:00:00.000Z",
  };
}

test("merchandise buttons follow permissions, ownership, and server order state", () => {
  assert.equal(canReserveMerchandise(member), true);
  assert.equal(canReserveMerchandise(null), false);
  assert.equal(canCreateProduct(organizer), true);
  for (const actor of [member, volunteer, treasurer]) assert.equal(canCreateProduct(actor), false);
  assert.equal(canViewOfficerOrders(treasurer), true);
  assert.equal(canViewOfficerOrders(organizer), true);
  assert.equal(canViewOfficerOrders(member), false);

  assert.deepEqual(orderActions(member, order("pending_payment")), ["cancel"], "owners can cancel their own pending hold");
  assert.deepEqual(orderActions(member, order("pending_payment", "someone-else")), [], "members cannot act on another order");
  assert.deepEqual(orderActions(volunteer, order("pending_payment", "someone-else")), [], "door permission does not grant merchandise actions");
  assert.deepEqual(orderActions(treasurer, order("pending_payment", "someone-else")), ["confirm", "cancel"], "payment officers can confirm or cancel pending holds");
  assert.deepEqual(orderActions(organizer, order("paid", "someone-else")), ["fulfil"], "fulfilment appears only for paid orders");
  assert.deepEqual(orderActions(treasurer, order("paid", "someone-else")), [], "payment confirmation alone cannot fulfil");
  for (const status of ["fulfilled", "cancelled", "expired"] as const) assert.deepEqual(orderActions(organizer, order(status)), []);
});

test("announcement controls are exposed only to their exact permissions", () => {
  for (const actor of [member, volunteer, treasurer, null]) {
    assert.equal(canPublishAnnouncement(actor), false);
    assert.equal(canInspectOutbox(actor), false);
  }
  assert.equal(canPublishAnnouncement(organizer), true);
  assert.equal(canInspectOutbox(organizer), true);
});

test("order status copy distinguishes pending payment, payment, hand-over, cancellation, and expiry", () => {
  assert.deepEqual(["pending_payment", "paid", "fulfilled", "cancelled", "expired"].map((status) => orderStatusLabel(status as MerchOrder["status"])), ["Payment pending", "Payment confirmed", "Handed over", "Cancelled", "Hold expired"]);
});
