"use client";

import { useState } from "react";
import type { MerchOrder, MerchOrderStatus } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { money, titleCase } from "../../../_lib/format";
import { Alert, Countdown, EmptyState, ErrorState, Loading, PageHead, Tabs } from "../../../_components/ui";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

/* Azman's officer order desk ("Collection and payment"), split by status with his treasury pill tabs. */

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
        <PageHead eyebrow={<>CLUB <span>/</span> MERCHANDISE</>} title="Orders desk" />
        <ShopNav active="shop" />
        <section className="panel"><EmptyState title="Officers only" icon="bag">Confirming payments and handing over orders needs the organizer, treasurer or admin role.</EmptyState></section>
      </>
    );
  }

  async function mutate(order: MerchOrder, verb: "confirm" | "cancel" | "fulfil") {
    if (verb === "cancel" && !window.confirm(`Cancel ${order.memberName}'s hold on ${order.productName} (${order.size} × ${order.quantity})?`)) return;
    const body = verb === "confirm" ? { reference: (references[order.id] ?? "").trim() } : {};
    await action.run(`${order.id}:${verb}`, async () => {
      try {
        const result = await api.post<{ order: MerchOrder; created?: boolean }>(`/api/orders/${encodeURIComponent(order.id)}/${verb}`, body);
        await orders.reload();
        if (verb === "confirm") return result.created === false ? "This order was already paid; nothing was posted again." : `Payment recorded for ${order.memberName}. ${money(order.totalPaise)} posted to the ledger.`;
        if (verb === "fulfil") return "Order marked as handed over.";
        return "Hold cancelled and stock released.";
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "hold_expired") void orders.reload();
        throw caught;
      }
    });
  }

  const rows = orders.data?.orders ?? [];

  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> MERCHANDISE</>} title="Orders desk" description="Record payment references for held orders, then hand over paid items." />
      <ShopNav active="desk" />
      <Tabs value={tab} onChange={setTab} items={[{ value: "pending_payment", label: "Awaiting payment" }, { value: "paid", label: "Paid · to hand over" }, { value: "fulfilled", label: "Fulfilled" }, { value: "closed", label: "Cancelled / expired" }]} />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading label="Arranging the desk…" /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} title="The desk could not load" /> : (
        <section className="merch-register" aria-labelledby="desk-register-heading">
          <div className="merch-register-heading">
            <div><span className="eyebrow">OFFICER ORDER DESK</span><h2 id="desk-register-heading">Collection and payment</h2></div>
            <button className="text-button" type="button" disabled={orders.loading} onClick={() => void orders.reload()}>Refresh stock ↻</button>
          </div>
          {!rows.length ? (
            <p className="merch-empty-register">{tab === "pending_payment" ? "No orders waiting for payment. Held orders appear here soonest-expiring first." : tab === "paid" ? "Nothing to hand over right now." : "No orders here yet."}</p>
          ) : (
            <div className="merch-orders">
              {rows.map((order) => {
                const pending = order.status === "pending_payment";
                const canConfirm = pending && can("payments:confirm");
                const canFulfil = order.status === "paid" && can("orders:fulfil");
                const canCancel = pending && can("payments:confirm");
                const busy = action.busy?.startsWith(`${order.id}:`) ?? false;
                return (
                  <article key={order.id} className="merch-order-card">
                    <div>
                      <span className={`merch-order-status status-${order.status}`}>{titleCase(order.status)}</span>
                      <h3>{order.productName} · {order.size}</h3>
                      <p>{order.memberName} · quantity {order.quantity} · {money(order.totalPaise)} · {order.pricing} price</p>
                      {pending && order.holdExpiresAt ? <small>Hold until {new Date(order.holdExpiresAt).toLocaleString()} · <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /> left</small> : null}
                      {order.status === "paid" ? <small>Paid{order.paidAt ? ` ${new Date(order.paidAt).toLocaleString()}` : ""}{order.paymentReference ? ` · ref ${order.paymentReference}` : ""}</small> : null}
                      {order.status === "fulfilled" ? <small>Handed over{order.fulfilledAt ? ` ${new Date(order.fulfilledAt).toLocaleString()}` : ""}</small> : null}
                      {order.status === "cancelled" || order.status === "expired" ? <small>{new Date(order.updatedAt).toLocaleString()}</small> : null}
                    </div>
                    <div className="merch-order-actions">
                      {canConfirm ? <input aria-label={`Payment reference for ${order.memberName}`} placeholder="Payment reference" value={references[order.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} /> : null}
                      {canConfirm ? <button className="button-small green-btn" type="button" disabled={busy || (references[order.id] ?? "").trim().length < 3} onClick={() => void mutate(order, "confirm")}>Record payment</button> : null}
                      {pending && !can("payments:confirm") ? <small>Treasurer or organizer confirms</small> : null}
                      {canFulfil ? <button className="button-small green-btn" type="button" disabled={busy} onClick={() => void mutate(order, "fulfil")}>Handed over</button> : null}
                      {order.status === "paid" && !can("orders:fulfil") ? <small>Organizer hands over</small> : null}
                      {canCancel ? <button className="button-small red-btn" type="button" disabled={busy} onClick={() => void mutate(order, "cancel")}>Cancel hold</button> : null}
                    </div>
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
