"use client";

import { useState } from "react";
import type { MerchOrder } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../../_lib/api";
import { money, titleCase } from "../../../_lib/format";
import { Alert, Countdown, EmptyState, ErrorState, LinkButton, Loading, PageHead, Segmented } from "../../../_components/ui";
import { ShopNav } from "../_nav";

/* Azman's "Your reservations" register (merch-register / merch-order-card) with a live/history switch. */

const LIVE: MerchOrder["status"][] = ["pending_payment", "paid"];

export default function MyOrdersPage() {
  const orders = useLoad(() => api.get<{ orders: MerchOrder[] }>("/api/orders/mine"));
  const [view, setView] = useState<"live" | "history">("live");
  const action = useAction();

  const all = orders.data?.orders ?? [];
  const rows = all.filter((o) => (view === "live" ? LIVE.includes(o.status) : !LIVE.includes(o.status)));

  async function cancel(order: MerchOrder) {
    if (!window.confirm(`Cancel your hold on ${order.productName} (${order.size} × ${order.quantity})?`)) return;
    const ok = await action.run(order.id, async () => {
      await api.post(`/api/orders/${encodeURIComponent(order.id)}/cancel`);
      await orders.reload();
      return "Hold cancelled and stock released.";
    });
    if (!ok) void orders.reload();
  }

  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> MERCHANDISE</>} title="My orders" description="Pending orders hold their size for 30 minutes. Pay at the desk and an officer confirms your reference." />
      <ShopNav active="orders" />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading label="Arranging your register…" /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} title="Your orders could not load" /> : (
        <section className="merch-register" aria-labelledby="orders-register-heading">
          <div className="merch-register-heading">
            <div><span className="eyebrow">MY ORDER REGISTER</span><h2 id="orders-register-heading">Your reservations</h2></div>
            <div className="mx-row">
              <Segmented value={view} onChange={setView} items={[{ value: "live", label: `Live (${all.filter((o) => LIVE.includes(o.status)).length})` }, { value: "history", label: `History (${all.filter((o) => !LIVE.includes(o.status)).length})` }]} />
              <button className="text-button" type="button" disabled={orders.loading} onClick={() => void orders.reload()}>Refresh stock ↻</button>
            </div>
          </div>
          {!rows.length ? (
            <div className="panel">
              <EmptyState title={view === "live" ? "No live orders" : "No past orders"} icon="bag" action={<LinkButton href="/app/shop" variant="primary">Browse the collection</LinkButton>}>
                {view === "live" ? "Orders you reserve appear here with their hold timer." : "Fulfilled, cancelled and expired orders show here."}
              </EmptyState>
            </div>
          ) : (
            <div className="merch-orders">
              {rows.map((order) => {
                const pending = order.status === "pending_payment";
                return (
                  <article key={order.id} className="merch-order-card">
                    <div>
                      <span className={`merch-order-status status-${order.status}`}>{titleCase(order.status)}</span>
                      <h3>{order.productName} · {order.size}</h3>
                      <p>{order.memberName} · quantity {order.quantity} · {money(order.totalPaise)} · {order.pricing} price</p>
                      {pending && order.holdExpiresAt ? <small>Hold until {new Date(order.holdExpiresAt).toLocaleString()} · <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /> left</small> : null}
                      {order.status === "paid" ? <small>Paid{order.paidAt ? ` ${new Date(order.paidAt).toLocaleString()}` : ""}{order.paymentReference ? ` · ref ${order.paymentReference}` : ""} · collect at the desk</small> : null}
                      {order.status === "fulfilled" ? <small>Handed over{order.fulfilledAt ? ` ${new Date(order.fulfilledAt).toLocaleString()}` : ""}</small> : null}
                      {order.status === "cancelled" || order.status === "expired" ? <small>{new Date(order.updatedAt).toLocaleString()}</small> : null}
                    </div>
                    {pending ? (
                      <div className="merch-order-actions">
                        <button className="button-small red-btn" type="button" disabled={action.busy === order.id} onClick={() => void cancel(order)}>Cancel hold</button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
