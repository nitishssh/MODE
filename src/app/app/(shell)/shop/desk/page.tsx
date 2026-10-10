"use client";

import { useState } from "react";
import type { MerchOrder, MerchOrderStatus } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { dateTime, money } from "../../../_lib/format";
import { Alert, Badge, Button, Countdown, EmptyState, ErrorState, Input, PageHead, Skeleton, StatusBadge, Table, Tabs } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

type Tab = "pending_payment" | "paid" | "fulfilled" | "closed";

export default function OrdersDeskPage() {
  const { can } = useSession();
  const allowed = can("payments:confirm") || can("orders:fulfil");
  const [tab, setTab] = useState<Tab>("pending_payment");
  const [references, setReferences] = useState<Record<string, string>>({});
  const action = useAction();

  const orders = useLoad(async () => {
    if (!allowed) return { orders: [] as MerchOrder[] };
    if (tab === "closed") {
      const [cancelled, expired] = await Promise.all([
        api.get<{ orders: MerchOrder[] }>("/api/orders?status=cancelled"),
        api.get<{ orders: MerchOrder[] }>("/api/orders?status=expired"),
      ]);
      return { orders: [...cancelled.orders, ...expired.orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    }
    return api.get<{ orders: MerchOrder[] }>(`/api/orders?status=${tab satisfies MerchOrderStatus}`);
  }, [tab, allowed]);

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow="Club shop" title="Orders desk" />
        <ShopNav active="shop" />
        <EmptyState title="Officers only">Confirming payments and handing over orders needs the organizer, treasurer or admin role.</EmptyState>
      </>
    );
  }

  async function mutate(order: MerchOrder, verb: "confirm" | "cancel" | "fulfil") {
    if (verb === "cancel" && !window.confirm(`Cancel ${order.memberName}'s hold on ${order.productName} (${order.size} × ${order.quantity})?`)) return;
    const body = verb === "confirm" ? { reference: (references[order.id] ?? "").trim() } : {};
    if (verb === "confirm" && body.reference && body.reference.length < 3) { action.setError("Enter the payment reference (at least 3 characters)."); return; }
    await action.run(`${verb}:${order.id}`, async () => {
      try {
        const result = await api.post<{ order: MerchOrder; created?: boolean }>(`/api/orders/${encodeURIComponent(order.id)}/${verb}`, body);
        await orders.reload();
        if (verb === "confirm") return result.created === false ? "This order was already paid; nothing was posted again." : `Payment recorded for ${order.memberName}. ${money(order.totalPaise)} posted to the ledger.`;
        if (verb === "fulfil") return `${order.productName} handed over to ${order.memberName}.`;
        return "Order cancelled and stock released.";
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "hold_expired") void orders.reload();
        throw caught;
      }
    });
  }

  const rows = orders.data?.orders ?? [];

  return (
    <>
      <PageHead eyebrow="Club shop" title="Orders desk" description="Record payment references for held orders, then hand over paid items." actions={<Button size="sm" onClick={() => void orders.reload()} loading={orders.loading && Boolean(orders.data)}><Icon.refresh />Refresh</Button>} />
      <ShopNav active="desk" />
      <Tabs value={tab} onChange={setTab} items={[{ value: "pending_payment", label: "Awaiting payment" }, { value: "paid", label: "Paid · to hand over" }, { value: "fulfilled", label: "Fulfilled" }, { value: "closed", label: "Cancelled / expired" }]} />
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}
      {orders.loading && !orders.data ? <Skeleton rows={5} /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} /> : !rows.length ? (
        <EmptyState title={tab === "pending_payment" ? "No orders waiting for payment" : tab === "paid" ? "Nothing to hand over" : "No orders here"}>
          {tab === "pending_payment" ? "Held orders appear here soonest-expiring first." : "Orders move here as their status changes."}
        </EmptyState>
      ) : (
        <Table head={<><th>Member</th><th>Item</th><th className="num">Total</th><th>Status</th><th>Timing</th><th className="actions">Actions</th></>}>
          {rows.map((order) => (
            <tr key={order.id}>
              <td><span className="mx-cell-title">{order.memberName}</span><span className="mx-cell-sub">placed {dateTime(order.createdAt)}</span></td>
              <td>{order.productName}<span className="mx-cell-sub">{order.size} × {order.quantity} · <Badge tone={order.pricing === "member" ? "green" : "neutral"}>{order.pricing}</Badge></span></td>
              <td className="num">{money(order.totalPaise)}</td>
              <td><StatusBadge status={order.status} /></td>
              <td>
                {order.status === "pending_payment" ? <>Hold <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /></> : null}
                {order.status === "paid" ? <span className="mx-muted mx-small">Paid {dateTime(order.paidAt)}{order.paymentReference ? ` · ref ${order.paymentReference}` : ""}</span> : null}
                {order.status === "fulfilled" ? <span className="mx-muted mx-small">Handed over {dateTime(order.fulfilledAt)}</span> : null}
                {order.status === "cancelled" || order.status === "expired" ? <span className="mx-muted mx-small">{dateTime(order.updatedAt)}</span> : null}
              </td>
              <td className="actions">
                {order.status === "pending_payment" ? (
                  <div className="mx-row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    {can("payments:confirm") ? (
                      <>
                        <Input className="sm" style={{ width: 150 }} placeholder="Payment reference" aria-label={`Payment reference for ${order.memberName}`} value={references[order.id] ?? ""} onChange={(e) => setReferences((c) => ({ ...c, [order.id]: e.target.value }))} />
                        <Button size="sm" variant="primary" disabled={(references[order.id] ?? "").trim().length < 3} loading={action.busy === `confirm:${order.id}`} onClick={() => void mutate(order, "confirm")}>Confirm</Button>
                        <Button size="sm" variant="danger" loading={action.busy === `cancel:${order.id}`} onClick={() => void mutate(order, "cancel")}>Cancel</Button>
                      </>
                    ) : <span className="mx-muted mx-small">Treasurer or organizer confirms</span>}
                  </div>
                ) : null}
                {order.status === "paid" ? (
                  can("orders:fulfil")
                    ? <Button size="sm" variant="accent" loading={action.busy === `fulfil:${order.id}`} onClick={() => void mutate(order, "fulfil")}><Icon.check />Hand over</Button>
                    : <span className="mx-muted mx-small">Organizer hands over</span>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
