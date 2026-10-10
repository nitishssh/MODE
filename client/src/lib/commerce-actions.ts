import type { MerchOrder, SessionUser } from "../generated/contracts";

export type OrderAction = "confirm" | "cancel" | "fulfil";

function permitted(user: SessionUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function canCreateProduct(user: SessionUser | null): boolean {
  return permitted(user, "products:write");
}

export function canReserveMerchandise(user: SessionUser | null): boolean {
  return permitted(user, "orders:create");
}

export function canViewOfficerOrders(user: SessionUser | null): boolean {
  return permitted(user, "payments:confirm") || permitted(user, "orders:fulfil");
}

export function orderActions(user: SessionUser | null, order: MerchOrder): OrderAction[] {
  if (!user) return [];
  const actions: OrderAction[] = [];
  if (order.status === "pending_payment") {
    if (permitted(user, "payments:confirm")) actions.push("confirm");
    if (order.memberId === user.id || permitted(user, "payments:confirm")) actions.push("cancel");
  }
  if (order.status === "paid" && permitted(user, "orders:fulfil")) actions.push("fulfil");
  return actions;
}

export function canPublishAnnouncement(user: SessionUser | null): boolean {
  return permitted(user, "announcements:write");
}

export function canInspectOutbox(user: SessionUser | null): boolean {
  return permitted(user, "outbox:manage");
}

export function orderStatusLabel(status: MerchOrder["status"]): string {
  return {
    pending_payment: "Payment pending",
    paid: "Payment confirmed",
    fulfilled: "Handed over",
    cancelled: "Cancelled",
    expired: "Hold expired",
  }[status];
}
