"use client";

import { useState } from "react";
import Link from "next/link";
import type { MerchOrder, Ticket } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { date, dateTime, money } from "../../_lib/format";
import { Button, Card, ErrorState, LinkButton, Money, PageHead, Skeleton, StatusBadge } from "../../_components/ui";
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
        eyebrow="Membership · door access"
        title="My member pass"
        description="Show this at the door. Admission depends on a paid ticket for the event the volunteer has selected, not on membership alone."
        actions={<Button onClick={() => void refresh()} loading={refreshing}><Icon.refresh />Refresh</Button>}
      />

      <div className="mx-grid mx-grid-side mx-mb">
        <Card tone="ink">
          <p className="mx-eyebrow">MODE · member pass</p>
          <h2 className="mx-h2" style={{ color: "#fff", marginTop: 10 }}>{user.name}</h2>
          <p className="mx-muted">{user.email}</p>
          <div className="mx-divider" style={{ background: "#ffffff1f" }} />
          <p className="mx-eyebrow">Membership</p>
          <div className="mx-row" style={{ marginTop: 6 }}>
            <StatusBadge status={pass.membership} label={pass.membership === "none" ? "Not joined" : undefined} />
            <span className="mx-small">{pass.expiresOn ? `Through ${date(pass.expiresOn)}` : ""}</span>
          </div>
          <p className="mx-small" style={{ marginTop: 6, color: "#b4c2c7" }}>{MEMBERSHIP_COPY[pass.membership]}</p>
          <p className="mx-eyebrow" style={{ marginTop: 18 }}>Door code</p>
          <p className="mx-code-big" style={{ color: "#fff" }}>{pass.shortCode}</p>
        </Card>

        <Card title="Scan or type">
          <div className="mx-row" style={{ alignItems: "flex-start", gap: 24 }}>
            <QrCode value={pass.qrToken} alt={`Member pass QR code. Typed alternative: ${pass.shortCode}`} />
            <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
              <p>The volunteer scans this QR, or types your door code <code className="mx-mono">{pass.shortCode}</code>.</p>
              <p className="mx-muted mx-small">A member pass resolves to your single live ticket for the selected event. If you have no ticket, the door will say so; buy one under Events first.</p>
              <p className="mx-muted mx-small">Your pass never changes. Refresh after an officer records your dues to see the new expiry.</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mx-grid mx-grid-2">
        <Card title="Your tickets" actions={<LinkButton href="/app/tickets" size="sm">All tickets<Icon.arrow /></LinkButton>}>
          {tickets.loading && !tickets.data ? <Skeleton rows={3} /> : tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : !liveTickets.length ? <p className="mx-muted">No tickets yet. <Link href="/app/events" className="mx-link">Find an event</Link>.</p> : (
            <div className="mx-list">
              {liveTickets.map((t) => (
                <div key={t.id} className="mx-list-item">
                  <div className="mx-grow">
                    <strong>{t.holderName} · <code className="mx-mono">{t.shortCode}</code></strong>
                    <small>{t.pricing} ticket · {money(t.pricePaise)}{t.status === "pending_payment" && t.holdExpiresAt ? ` · hold until ${dateTime(t.holdExpiresAt)}` : ""}{t.checkedInAt ? ` · checked in ${dateTime(t.checkedInAt)}` : ""}</small>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Your orders" actions={<LinkButton href="/app/shop/orders" size="sm">All orders<Icon.arrow /></LinkButton>}>
          {orders.loading && !orders.data ? <Skeleton rows={3} /> : orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} /> : !recentOrders.length ? <p className="mx-muted">No merchandise orders yet. <Link href="/app/shop" className="mx-link">Open the shop</Link>.</p> : (
            <div className="mx-list">
              {recentOrders.map((o) => (
                <div key={o.id} className="mx-list-item">
                  <div className="mx-grow">
                    <strong>{o.productName}</strong>
                    <small>{o.size} × {o.quantity} · <Money paise={o.totalPaise} /></small>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
