"use client";

import { useState } from "react";
import Link from "next/link";
import type { MerchOrder, Ticket } from "@/lib/contracts";
import type { AppKey } from "@/i18n/app";
import { api, useLoad } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { Button, ErrorState, PageHead, PreviewNote, Skeleton, StatusBadge, TextLink } from "../../_components/ui";
import { QrCode, passQrValue } from "../../_components/qr";
import { Icon } from "../../_components/icons";

export default function PassPage() {
  const { t, fmt } = useT();
  const session = useSession();
  const { user, pass } = session;
  const [refreshing, setRefreshing] = useState(false);
  const tickets = useLoad(() => api.get<{ tickets: Ticket[] }>("/api/tickets/mine"));
  const orders = useLoad(() => api.get<{ orders: MerchOrder[] }>("/api/orders/mine"));

  if (!user || !pass) return <Skeleton rows={5} />;

  async function refresh() {
    setRefreshing(true);
    try { await session.refresh(); } finally { setRefreshing(false); }
  }

  const price = (paise: number) => (paise === 0 ? t("state.free") : fmt.currency(paise));
  const liveTickets = [...(tickets.data?.tickets ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentOrders = [...(orders.data?.orders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <>
      <PageHead
        eyebrow={<>{t("pass.kicker")} <span>/</span> {t("pass.kickerSection")}</>}
        title={t("pass.title")}
        description={t("pass.lede")}
        actions={<Button onClick={() => void refresh()} loading={refreshing}><Icon name="clock" size={16} />{t("pass.refresh")}</Button>}
      />

      <div className="overview-grid">
        <article className="mx-wallet" aria-label={t("pass.cardKicker")}>
          <div className="mx-wallet-head">
            <span className="mx-wallet-brand">MODE<span>.</span></span>
            <span className="eyebrow">{t("pass.cardKicker")}</span>
          </div>
          <div className="mx-wallet-name">{user.name}</div>
          <div className="mx-wallet-email">{user.email}</div>
          <div className="mx-wallet-row">
            <StatusBadge status={pass.membership} label={pass.membership === "none" ? t("pass.notJoined") : undefined} />
            {pass.expiresOn ? <small>{t("membership.through", { date: fmt.date(pass.expiresOn) })}</small> : null}
          </div>
          <div className="mx-wallet-foot">
            <div>
              <div className="eyebrow">{t("pass.doorCode")}</div>
              <span className="mx-code-big">{pass.shortCode}</span>
            </div>
            <span className="mx-wallet-chip" aria-hidden="true" />
          </div>
        </article>

        <section className="panel">
          <div className="panel-heading">
            <div><div className="eyebrow">{t("pass.scan.kicker")}</div><h2>{t("pass.scan.title")}</h2></div>
          </div>
          <div className="panel-body">
            <div className="mx-pass-qr-wrap">
              <div className="mx-pass-qr"><QrCode value={passQrValue(pass.qrToken)} alt={t("pass.scan.qrAlt", { code: pass.shortCode })} /></div>
              <div>
                <ol className="mx-pass-steps">
                  <li><i>1</i><span>{t("pass.scan.body1")} <span className="payment-ref" style={{ display: "inline" }}>{pass.shortCode}</span>.</span></li>
                  <li><i>2</i><span>{t("pass.scan.body2")}</span></li>
                  <li><i>3</i><span>{t("pass.scan.body3")}</span></li>
                </ol>
                <p className="mx-muted mx-small" style={{ marginTop: 14 }}>{t(`pass.membership.${pass.membership}` as AppKey)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="overview-grid">
        <section className="panel events-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">{t("pass.tickets.kicker")}</div><h2>{t("pass.tickets.title")}</h2></div>
            <TextLink href="/app/tickets">{t("pass.tickets.all")}</TextLink>
          </div>
          {tickets.loading && !tickets.data ? <div className="panel-body"><Skeleton rows={3} /></div> : tickets.error ? <div className="panel-body"><ErrorState error={tickets.error} onRetry={tickets.reload} /></div> : !liveTickets.length ? (
            <div className="panel-body"><p className="mx-muted mx-small">{t("pass.tickets.empty")} <Link href="/app/events" className="mx-link">{t("pass.tickets.findEvent")}</Link>.</p></div>
          ) : (
            <div className="event-list">
              {liveTickets.map((ticket) => (
                <div key={ticket.id} className="event-row">
                  <div className="event-info">
                    <h3>{ticket.holderName} · <span className="payment-ref" style={{ display: "inline" }}>{ticket.shortCode}</span></h3>
                    <p>
                      {t("pass.tickets.line", { pricing: t(`pricing.${ticket.pricing}` as AppKey), price: price(ticket.pricePaise) })}
                      {ticket.status === "pending_payment" && ticket.holdExpiresAt ? ` · ${t("pass.tickets.holdUntil", { time: fmt.dateTime(ticket.holdExpiresAt) })}` : ""}
                      {ticket.checkedInAt ? ` · ${t("pass.tickets.checkedIn", { time: fmt.dateTime(ticket.checkedInAt) })}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>
              ))}
            </div>
          )}
          <div className="panel-footnote"><span className="tiny-dot" />{t("pass.tickets.footnote")}</div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div><div className="eyebrow">{t("pass.orders.kicker")}</div><h2>{t("pass.orders.title")}</h2></div>
            <TextLink href="/app/shop/orders">{t("pass.orders.all")}</TextLink>
          </div>
          {orders.loading && !orders.data ? <div className="panel-body"><Skeleton rows={3} /></div> : orders.error ? <div className="panel-body"><ErrorState error={orders.error} onRetry={orders.reload} /></div> : !recentOrders.length ? (
            <div className="panel-body"><p className="mx-muted mx-small">{t("pass.orders.empty")} <Link href="/app/shop" className="mx-link">{t("pass.orders.openShop")}</Link>.</p></div>
          ) : (
            <div className="event-list">
              {recentOrders.map((order) => (
                <div key={order.id} className="event-row">
                  <div className="event-info">
                    <h3>{order.productName}</h3>
                    <p>{order.size} × {order.quantity} · {price(order.totalPaise)}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <PreviewNote>{t("pass.previewNote")}</PreviewNote>
    </>
  );
}
