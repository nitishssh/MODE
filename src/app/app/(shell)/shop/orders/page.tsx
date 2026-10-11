"use client";

import { useState } from "react";
import type { MerchOrder } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../../_lib/api";
import { useT } from "../../../_lib/i18n";
import { Alert, Countdown, EmptyState, ErrorState, LinkButton, Loading, PageHead, Segmented } from "../../../_components/ui";
import { ShopNav } from "../_nav";

/* Azman's "Your reservations" register (merch-register / merch-order-card) with a live/history switch. */

const LIVE: MerchOrder["status"][] = ["pending_payment", "paid"];

export default function MyOrdersPage() {
  const { t, fmt, apiError } = useT();
  const orders = useLoad(() => api.get<{ orders: MerchOrder[] }>("/api/orders/mine"));
  const [view, setView] = useState<"live" | "history">("live");
  const action = useAction();

  const all = orders.data?.orders ?? [];
  const rows = all.filter((o) => (view === "live" ? LIVE.includes(o.status) : !LIVE.includes(o.status)));

  async function cancel(order: MerchOrder) {
    if (!window.confirm(t("shop.orders.confirmCancel", { product: order.productName, size: order.size, quantity: order.quantity }))) return;
    const ok = await action.run(order.id, async () => {
      try {
        await api.post(`/api/orders/${encodeURIComponent(order.id)}/cancel`);
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      await orders.reload();
      return t("shop.order.cancelled");
    });
    if (!ok) void orders.reload();
  }

  return (
    <>
      <PageHead eyebrow={<>{t("shop.eyebrowClub")} <span>/</span> {t("shop.eyebrow")}</>} title={t("shop.orders.title")} description={t("shop.orders.description")} />
      <ShopNav active="orders" />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading label={t("shop.orders.loading")} /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} title={t("shop.orders.errorTitle")} /> : (
        <section className="merch-register" aria-labelledby="orders-register-heading">
          <div className="merch-register-heading">
            <div><span className="eyebrow">{t("shop.orders.kicker")}</span><h2 id="orders-register-heading">{t("shop.orders.registerTitle")}</h2></div>
            <div className="mx-row">
              <Segmented value={view} onChange={setView} items={[{ value: "live", label: t("shop.orders.live", { count: all.filter((o) => LIVE.includes(o.status)).length }) }, { value: "history", label: t("shop.orders.history", { count: all.filter((o) => !LIVE.includes(o.status)).length }) }]} />
              <button className="text-button" type="button" disabled={orders.loading} onClick={() => void orders.reload()}>{t("shop.order.refreshStock")}</button>
            </div>
          </div>
          {!rows.length ? (
            <div className="panel">
              <EmptyState title={view === "live" ? t("shop.orders.emptyLiveTitle") : t("shop.orders.emptyHistoryTitle")} icon="bag" action={<LinkButton href="/app/shop" variant="primary">{t("shop.orders.browse")}</LinkButton>}>
                {view === "live" ? t("shop.orders.emptyLiveBody") : t("shop.orders.emptyHistoryBody")}
              </EmptyState>
            </div>
          ) : (
            <div className="merch-orders">
              {rows.map((order) => {
                const pending = order.status === "pending_payment";
                return (
                  <article key={order.id} className="merch-order-card">
                    <div>
                      <span className={`merch-order-status status-${order.status}`}>{t(`status.${order.status}`)}</span>
                      <h3>{order.productName} · {order.size}</h3>
                      <p>{t("shop.order.line", { member: order.memberName, quantity: order.quantity, total: fmt.currency(order.totalPaise), pricing: t(`pricing.${order.pricing}`) })}</p>
                      {pending && order.holdExpiresAt ? <small>{t("time.holdUntil", { time: fmt.dateTime(order.holdExpiresAt) })} · <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /> {t("shop.order.left")}</small> : null}
                      {order.status === "paid" ? <small>{[`${t("shop.order.paid")}${order.paidAt ? ` ${fmt.dateTime(order.paidAt)}` : ""}`, order.paymentReference ? t("shop.order.ref", { reference: order.paymentReference }) : null, t("shop.order.collect")].filter(Boolean).join(" · ")}</small> : null}
                      {order.status === "fulfilled" ? <small>{t("shop.order.handedOver")}{order.fulfilledAt ? ` ${fmt.dateTime(order.fulfilledAt)}` : ""}</small> : null}
                      {order.status === "cancelled" || order.status === "expired" ? <small>{fmt.dateTime(order.updatedAt)}</small> : null}
                    </div>
                    {pending ? (
                      <div className="merch-order-actions">
                        <button className="button-small red-btn" type="button" disabled={action.busy === order.id} onClick={() => void cancel(order)}>{t("shop.order.cancelHold")}</button>
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
