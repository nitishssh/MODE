"use client";

import { useState } from "react";
import type { MerchOrder } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../../_lib/api";
import { dateTime, money } from "../../../_lib/format";
import { Alert, Badge, Button, Countdown, EmptyState, ErrorState, LinkButton, PageHead, Segmented, Skeleton, StatusBadge, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { ShopNav } from "../_nav";

const LIVE: MerchOrder["status"][] = ["pending_payment", "paid"];

export default function MyOrdersPage() {
  const orders = useLoad(() => api.get<{ orders: MerchOrder[] }>("/api/orders/mine"));
  const [view, setView] = useState<"live" | "history">("live");
  const action = useAction();

  const all = orders.data?.orders ?? [];
  const rows = all.filter((o) => (view === "live" ? LIVE.includes(o.status) : !LIVE.includes(o.status)));

  async function cancel(order: MerchOrder) {
    if (!window.confirm(`Cancel your hold on ${order.productName} (${order.size} × ${order.quantity})?`)) return;
    await action.run(order.id, async () => {
      await api.post(`/api/orders/${encodeURIComponent(order.id)}/cancel`);
      await orders.reload();
      return "Order cancelled. The units are back in stock.";
    });
    if (action.error) void orders.reload();
  }

  return (
    <>
      <PageHead eyebrow="Club shop" title="My orders" description="Pending orders hold their size for 30 minutes. Pay at the desk and an officer confirms your reference." actions={<Button size="sm" onClick={() => void orders.reload()} loading={orders.loading && Boolean(orders.data)}><Icon.refresh />Refresh</Button>} />
      <ShopNav active="orders" />
      <div className="mx-toolbar">
        <Segmented value={view} onChange={setView} items={[{ value: "live", label: `Live (${all.filter((o) => LIVE.includes(o.status)).length})` }, { value: "history", label: `History (${all.filter((o) => !LIVE.includes(o.status)).length})` }]} />
      </div>
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}
      {orders.loading && !orders.data ? <Skeleton rows={5} /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} /> : !rows.length ? (
        <EmptyState title={view === "live" ? "No live orders" : "No past orders"} action={<LinkButton href="/app/shop" size="sm">Browse the shop<Icon.arrow /></LinkButton>}>
          {view === "live" ? "Orders you place appear here with their hold timer." : "Fulfilled, cancelled and expired orders show here."}
        </EmptyState>
      ) : (
        <Table head={<><th>Item</th><th className="num">Total</th><th>Pricing</th><th>Status</th><th>Timing</th><th className="actions" /></>}>
          {rows.map((order) => (
            <tr key={order.id}>
              <td><span className="mx-cell-title">{order.productName}</span><span className="mx-cell-sub">{order.size} × {order.quantity} · placed {dateTime(order.createdAt)}</span></td>
              <td className="num">{money(order.totalPaise)}</td>
              <td><Badge tone={order.pricing === "member" ? "green" : "neutral"}>{order.pricing}</Badge></td>
              <td><StatusBadge status={order.status} /></td>
              <td>
                {order.status === "pending_payment" ? <>Hold <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /></> : null}
                {order.status === "paid" ? <span className="mx-muted mx-small">Paid {dateTime(order.paidAt)}{order.paymentReference ? ` · ref ${order.paymentReference}` : ""}</span> : null}
                {order.status === "fulfilled" ? <span className="mx-muted mx-small">Handed over {dateTime(order.fulfilledAt)}</span> : null}
                {order.status === "cancelled" || order.status === "expired" ? <span className="mx-muted mx-small">{dateTime(order.updatedAt)}</span> : null}
              </td>
              <td className="actions">{order.status === "pending_payment" ? <Button size="sm" variant="danger" loading={action.busy === order.id} onClick={() => void cancel(order)}>Cancel</Button> : null}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
