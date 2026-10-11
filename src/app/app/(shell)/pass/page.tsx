"use client";

import { useState } from "react";
import Link from "next/link";
import type { MerchOrder, Ticket } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { date, dateTime, money } from "../../_lib/format";
import { Button, ErrorState, PageHead, PreviewNote, Skeleton, StatusBadge, TextLink } from "../../_components/ui";
import { QrCode } from "../../_components/qr";
import { Icon } from "../../_components/icons";

const MEMBERSHIP_COPY = {
  active: "Active membership",
  expired: "Membership expired. Renew with an officer.",
  none: "Not yet a paid member. Ask an officer about dues.",
} as const;

export default function PassPage() {
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

  const liveTickets = [...(tickets.data?.tickets ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentOrders = [...(orders.data?.orders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <>
      <PageHead
        eyebrow={<>MEMBERSHIP <span>/</span> DOOR ACCESS</>}
        title="My member pass"
        description="Show this at the door. Admission depends on a paid ticket for the event the volunteer has selected, not on membership alone."
        actions={<Button onClick={() => void refresh()} loading={refreshing}><Icon name="clock" size={16} />Refresh membership</Button>}
      />

      <div className="overview-grid">
        <article className="metric-card metric-dark" style={{ padding: 27 }}>
          <div className="metric-top">
            <span>MODE · MEMBER PASS</span>
            <span className="metric-icon"><Icon name="coin" size={18} /></span>
          </div>
          <strong className="metric-value">{user.name}</strong>
          <p>{user.email}</p>
          <div className="mx-row" style={{ marginTop: 18 }}>
            <StatusBadge status={pass.membership} label={pass.membership === "none" ? "Not joined" : undefined} />
            {pass.expiresOn ? <span className="mx-small" style={{ color: "#c4d0d2" }}>Through {date(pass.expiresOn)}</span> : null}
          </div>
          <p>{MEMBERSHIP_COPY[pass.membership]}</p>
          <div className="eyebrow" style={{ marginTop: 22, color: "#c4d0d2" }}>DOOR CODE</div>
          <span className="mx-code-big" style={{ color: "#fff", display: "block", marginTop: 6 }}>{pass.shortCode}</span>
        </article>

        <section className="panel">
          <div className="panel-heading">
            <div><div className="eyebrow">MEMBERSHIP / DOOR ACCESS</div><h2>Scan or type</h2></div>
          </div>
          <div className="panel-body">
            <div className="mx-row" style={{ alignItems: "flex-start", gap: 24 }}>
              <QrCode value={pass.qrToken} alt={`Member pass QR code. Typed alternative: ${pass.shortCode}`} />
              <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
                <p className="mx-small">The volunteer scans this QR, or types your door code <span className="payment-ref" style={{ display: "inline" }}>{pass.shortCode}</span>.</p>
                <p className="mx-muted mx-small">A member pass resolves to your single live ticket for the selected event. If you have no ticket, the door will say so; book one under Events first.</p>
                <p className="mx-muted mx-small">Your pass never changes. Refresh after an officer records your dues to see the new expiry.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="overview-grid">
        <section className="panel events-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">EVENT REGISTER</div><h2>Your tickets</h2></div>
            <TextLink href="/app/tickets">All tickets</TextLink>
          </div>
          {tickets.loading && !tickets.data ? <div className="panel-body"><Skeleton rows={3} /></div> : tickets.error ? <div className="panel-body"><ErrorState error={tickets.error} onRetry={tickets.reload} /></div> : !liveTickets.length ? (
            <div className="panel-body"><p className="mx-muted mx-small">No tickets yet. <Link href="/app/events" className="mx-link">Find an event</Link>.</p></div>
          ) : (
            <div className="event-list">
              {liveTickets.map((t) => (
                <div key={t.id} className="event-row">
                  <div className="event-info">
                    <h3>{t.holderName} · <span className="payment-ref" style={{ display: "inline" }}>{t.shortCode}</span></h3>
                    <p>{t.pricing} ticket · {money(t.pricePaise)}{t.status === "pending_payment" && t.holdExpiresAt ? ` · hold until ${dateTime(t.holdExpiresAt)}` : ""}{t.checkedInAt ? ` · checked in ${dateTime(t.checkedInAt)}` : ""}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
          <div className="panel-footnote"><span className="tiny-dot" />An officer confirms your payment at the desk; after that your QR admits you at the door.</div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div><div className="eyebrow">CLUB SHOP</div><h2>Your orders</h2></div>
            <TextLink href="/app/shop/orders">All orders</TextLink>
          </div>
          {orders.loading && !orders.data ? <div className="panel-body"><Skeleton rows={3} /></div> : orders.error ? <div className="panel-body"><ErrorState error={orders.error} onRetry={orders.reload} /></div> : !recentOrders.length ? (
            <div className="panel-body"><p className="mx-muted mx-small">No merchandise orders yet. <Link href="/app/shop" className="mx-link">Open the shop</Link>.</p></div>
          ) : (
            <div className="event-list">
              {recentOrders.map((o) => (
                <div key={o.id} className="event-row">
                  <div className="event-info">
                    <h3>{o.productName}</h3>
                    <p>{o.size} × {o.quantity} · {money(o.totalPaise)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <PreviewNote>Door scanning resolves your pass by its QR token or typed code, never by an account id.</PreviewNote>
    </>
  );
}
