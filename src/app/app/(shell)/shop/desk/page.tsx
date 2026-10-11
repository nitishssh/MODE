"use client";

import { useState } from "react";
import type { MerchOrder, MerchOrderStatus } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { useT } from "../../../_lib/i18n";
import { Alert, Countdown, EmptyState, ErrorState, Loading, PageHead, Tabs } from "../../../_components/ui";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

/* Azman's officer order desk ("Collection and payment"), split by status with his treasury pill tabs. */

type Tab = "pending_payment" | "paid" | "fulfilled" | "closed";

export default function OrdersDeskPage() {
  const { can } = useSession();
  const { t, fmt, apiError } = useT();
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

  const eyebrow = <>{t("shop.eyebrowClub")} <span>/</span> {t("shop.eyebrow")}</>;

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("shop.desk.title")} />
        <ShopNav active="shop" />
        <section className="panel"><EmptyState title={t("state.officerOnlyTitle")} icon="bag">{t("shop.desk.officersOnlyBody")}</EmptyState></section>
      </>
    );
  }

  async function mutate(order: MerchOrder, verb: "confirm" | "cancel" | "fulfil") {
    if (verb === "cancel" && !window.confirm(t("shop.desk.confirmCancel", { member: order.memberName, product: order.productName, size: order.size, quantity: order.quantity }))) return;
    const body = verb === "confirm" ? { reference: (references[order.id] ?? "").trim() } : {};
    await action.run(`${order.id}:${verb}`, async () => {
      try {
        const result = await api.post<{ order: MerchOrder; created?: boolean }>(`/api/orders/${encodeURIComponent(order.id)}/${verb}`, body);
        await orders.reload();
        if (verb === "confirm") return result.created === false ? t("shop.desk.alreadyPaid") : t("shop.desk.paymentRecorded", { name: order.memberName, amount: fmt.currency(order.totalPaise) });
        if (verb === "fulfil") return t("shop.desk.markedHandedOver");
        return t("shop.order.cancelled");
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "hold_expired") void orders.reload();
        throw new Error(apiError(caught));
      }
    });
  }

  const rows = orders.data?.orders ?? [];

  return (
    <>
      <PageHead eyebrow={eyebrow} title={t("shop.desk.title")} description={t("shop.desk.description")} />
      <ShopNav active="desk" />
      <Tabs value={tab} onChange={setTab} items={[{ value: "pending_payment", label: t("shop.desk.tab.awaiting") }, { value: "paid", label: t("shop.desk.tab.paid") }, { value: "fulfilled", label: t("status.fulfilled") }, { value: "closed", label: t("shop.desk.tab.closed") }]} />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {orders.loading && !orders.data ? <Loading label={t("shop.desk.loading")} /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} title={t("shop.desk.errorTitle")} /> : (
        <section className="merch-register" aria-labelledby="desk-register-heading">
          <div className="merch-register-heading">
            <div><span className="eyebrow">{t("shop.desk.kicker")}</span><h2 id="desk-register-heading">{t("shop.desk.registerTitle")}</h2></div>
            <button className="text-button" type="button" disabled={orders.loading} onClick={() => void orders.reload()}>{t("shop.order.refreshStock")}</button>
          </div>
          {!rows.length ? (
            <p className="merch-empty-register">{tab === "pending_payment" ? t("shop.desk.emptyPending") : tab === "paid" ? t("shop.desk.emptyPaid") : t("shop.desk.emptyOther")}</p>
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
                      <span className={`merch-order-status status-${order.status}`}>{t(`status.${order.status}`)}</span>
                      <h3>{order.productName} · {order.size}</h3>
                      <p>{t("shop.order.line", { member: order.memberName, quantity: order.quantity, total: fmt.currency(order.totalPaise), pricing: t(`pricing.${order.pricing}`) })}</p>
                      {pending && order.holdExpiresAt ? <small>{t("time.holdUntil", { time: fmt.dateTime(order.holdExpiresAt) })} · <Countdown until={order.holdExpiresAt} onExpire={() => void orders.reload()} /> {t("shop.order.left")}</small> : null}
                      {order.status === "paid" ? <small>{[`${t("shop.order.paid")}${order.paidAt ? ` ${fmt.dateTime(order.paidAt)}` : ""}`, order.paymentReference ? t("shop.order.ref", { reference: order.paymentReference }) : null].filter(Boolean).join(" · ")}</small> : null}
                      {order.status === "fulfilled" ? <small>{t("shop.order.handedOver")}{order.fulfilledAt ? ` ${fmt.dateTime(order.fulfilledAt)}` : ""}</small> : null}
                      {order.status === "cancelled" || order.status === "expired" ? <small>{fmt.dateTime(order.updatedAt)}</small> : null}
                    </div>
                    <div className="merch-order-actions">
                      {canConfirm ? <input aria-label={t("shop.desk.referenceFor", { name: order.memberName })} placeholder={t("shop.desk.referencePlaceholder")} value={references[order.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} /> : null}
                      {canConfirm ? <button className="button-small green-btn" type="button" disabled={busy || (references[order.id] ?? "").trim().length < 3} onClick={() => void mutate(order, "confirm")}>{t("shop.desk.recordPayment")}</button> : null}
                      {pending && !can("payments:confirm") ? <small>{t("shop.desk.treasurerConfirms")}</small> : null}
                      {canFulfil ? <button className="button-small green-btn" type="button" disabled={busy} onClick={() => void mutate(order, "fulfil")}>{t("shop.desk.handedOverButton")}</button> : null}
                      {order.status === "paid" && !can("orders:fulfil") ? <small>{t("shop.desk.organizerHandsOver")}</small> : null}
                      {canCancel ? <button className="button-small red-btn" type="button" disabled={busy} onClick={() => void mutate(order, "cancel")}>{t("shop.order.cancelHold")}</button> : null}
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
