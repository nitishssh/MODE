"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventDetails, Ticket } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { dateTime, money } from "../../_lib/format";
import { Alert, Button, Card, Countdown, EmptyState, ErrorState, KeyValue, LinkButton, PageHead, Segmented, Skeleton, StatusBadge, When } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { QrCode } from "../../_components/qr";

type View = "live" | "past";

function TicketCard({ ticket, event, reload }: { ticket: Ticket; event?: EventDetails; reload: () => Promise<void> }) {
  const action = useAction();
  const live = ticket.status === "pending_payment" || ticket.status === "paid";
  return (
    <Card title={event?.title ?? "Event"} actions={<StatusBadge status={ticket.status} />}>
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      <div className="mx-row" style={{ alignItems: "flex-start", gap: 20 }}>
        {live && ticket.qrToken ? <QrCode value={ticket.qrToken} alt={`Ticket QR. Typed code ${ticket.shortCode}`} size={150} /> : null}
        <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
          <div><p className="mx-eyebrow">Door code</p><p className="mx-code-big" style={{ fontSize: 24 }}>{ticket.shortCode}</p></div>
          <KeyValue items={[
            { label: "When", value: event ? dateTime(event.startsAt) : "—" },
            { label: "Where", value: event?.venue ?? "—" },
            { label: "Holder", value: ticket.holderName },
            { label: "Price", value: <>{money(ticket.pricePaise)} <span className="mx-muted">({ticket.pricing} rate)</span></> },
            ...(ticket.status === "pending_payment" ? [{ label: "Hold expires", value: <Countdown until={ticket.holdExpiresAt} onExpire={() => void reload()} /> }] : []),
            ...(ticket.paidAt ? [{ label: "Paid", value: <When iso={ticket.paidAt} /> }] : []),
            ...(ticket.checkedInAt ? [{ label: "Checked in", value: <When iso={ticket.checkedInAt} /> }] : []),
          ]} />
          <div className="mx-row" style={{ marginTop: 4 }}>
            <Link href={`/app/events/${ticket.eventId}`} className="mx-link mx-small">Event details →</Link>
            {ticket.status === "pending_payment" ? <Button size="sm" variant="danger" loading={action.busy === ticket.id} onClick={() => void action.run(ticket.id, async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await reload(); })}>Cancel hold</Button> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function MyTicketsPage() {
  const [view, setView] = useState<View>("live");
  const tickets = useLoad(() => api.get<{ tickets: Ticket[] }>("/api/tickets/mine"));
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));
  const byEvent = new Map((events.data?.events ?? []).map((e) => [e.id, e]));

  const all = tickets.data?.tickets ?? [];
  const live = all.filter((t) => t.status === "pending_payment" || t.status === "paid");
  const past = all.filter((t) => t.status === "cancelled" || t.status === "expired");
  const list = (view === "live" ? live : past).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHead
        eyebrow="Tickets"
        title="My tickets"
        description="A booked seat is held for 30 minutes. An officer confirms your payment at the desk; after that your QR admits you at the door."
        actions={<LinkButton href="/app/events" variant="primary"><Icon.calendar />Browse events</LinkButton>}
      />
      <div className="mx-toolbar">
        <Segmented value={view} onChange={setView} items={[{ value: "live", label: `Live (${live.length})` }, { value: "past", label: `Past (${past.length})` }]} />
        <Button size="sm" variant="ghost" onClick={() => void tickets.reload()}><Icon.refresh />Refresh</Button>
      </div>
      {tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : tickets.loading && !tickets.data ? <Skeleton rows={6} /> : !list.length ? (
        <EmptyState title={view === "live" ? "No live tickets" : "No past tickets"} action={view === "live" ? <LinkButton href="/app/events">Find an event</LinkButton> : undefined}>
          {view === "live" ? "Book a seat from the Events page." : "Cancelled and expired holds appear here."}
        </EmptyState>
      ) : (
        <div className="mx-grid mx-grid-2">
          {list.map((t) => <TicketCard key={t.id} ticket={t} event={byEvent.get(t.eventId)} reload={tickets.reload} />)}
        </div>
      )}
    </>
  );
}
