"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventDetails, Ticket } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { dateTime, money } from "../../_lib/format";
import { Countdown, EmptyState, ErrorState, PageHead, PreviewNote, Segmented, Skeleton, StatusBadge, When } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { QrCode } from "../../_components/qr";

/* Tickets as .panel.event-card articles, in Azman's event-card rhythm. */

type View = "live" | "past";

function monthShort(iso: string) { return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)).toUpperCase(); }
function dayOfMonth(iso: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)); }

function TicketCard({ ticket, event, reload, index }: { ticket: Ticket; event?: EventDetails; reload: () => Promise<void>; index: number }) {
  const action = useAction();
  const live = ticket.status === "pending_payment" || ticket.status === "paid";
  return (
    <article className="panel event-card">
      <div className="event-card-top">
        {event
          ? <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{monthShort(event.startsAt)}</span><strong>{dayOfMonth(event.startsAt)}</strong></div>
          : <div className="date-tile coral"><span>EVENT</span><strong>?</strong></div>}
        <StatusBadge status={ticket.status} />
      </div>
      <h2>{event?.title ?? "Event"}</h2>
      <p>{event ? `${event.venue} · ${dateTime(event.startsAt)}` : "Event details unavailable"}</p>
      <div className="mx-row mx-mt" style={{ alignItems: "flex-start", gap: 20 }}>
        {live && ticket.qrToken ? <QrCode value={ticket.qrToken} alt={`Ticket QR. Typed code ${ticket.shortCode}`} size={150} /> : null}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="eyebrow">DOOR CODE</div>
          <p className="mx-code-big" style={{ fontSize: 24 }}>{ticket.shortCode}</p>
          <div className="ticket-prices" style={{ gap: 30 }}>
            <div><span>Holder</span><strong style={{ fontSize: 14 }}>{ticket.holderName}</strong></div>
            <div><span>{ticket.pricing} rate</span><strong>{money(ticket.pricePaise)}</strong></div>
          </div>
          {ticket.status === "pending_payment" ? <p className="mx-small mx-mt"><span className="mx-muted">Hold expires in</span> <Countdown until={ticket.holdExpiresAt} onExpire={() => void reload()} /></p> : null}
          {ticket.paidAt ? <p className="mx-small mx-mt"><span className="mx-muted">Paid</span> <When iso={ticket.paidAt} /></p> : null}
          {ticket.checkedInAt ? <p className="mx-small"><span className="mx-muted">Checked in</span> <When iso={ticket.checkedInAt} /></p> : null}
        </div>
      </div>
      {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
      <div className="mx-row mx-mt">
        <Link href={`/app/events/${ticket.eventId}`} className="text-button">Event details<Icon name="arrow" size={16} /></Link>
        {ticket.status === "pending_payment" ? <button type="button" className="button-small red-btn" disabled={action.busy === ticket.id} onClick={() => void action.run(ticket.id, async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await reload(); })}>{action.busy === ticket.id ? "Cancelling…" : "Cancel hold"}</button> : null}
      </div>
    </article>
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
        eyebrow={<>YOU <span>/</span> TICKETS</>}
        title="My tickets"
        description="A booked seat is held for 30 minutes. An officer confirms your payment at the desk; after that your QR admits you at the door."
        actions={<Link href="/app/events" className="button primary"><Icon name="calendar" size={18} />Browse events</Link>}
      />
      <div className="task-toolbar">
        <Segmented value={view} onChange={setView} items={[{ value: "live", label: `Live (${live.length})` }, { value: "past", label: `Past (${past.length})` }]} />
        <button type="button" className="text-button" onClick={() => void tickets.reload()}>Refresh<Icon name="refresh" size={14} /></button>
      </div>
      {tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : tickets.loading && !tickets.data ? <Skeleton rows={6} /> : !list.length ? (
        <section className="panel">
          <EmptyState title={view === "live" ? "No live tickets" : "No past tickets"} icon="ticket" action={view === "live" ? <Link href="/app/events" className="button primary">Find an event</Link> : undefined}>
            {view === "live" ? "Book a seat from the Events page." : "Cancelled and expired holds appear here."}
          </EmptyState>
        </section>
      ) : (
        <div className="event-cards">
          {list.map((t, index) => <TicketCard key={t.id} ticket={t} index={index} event={byEvent.get(t.eventId)} reload={tickets.reload} />)}
        </div>
      )}
      <PreviewNote>Paid tickets cannot be cancelled: refunds are out of scope. Show the QR or type the door code to the volunteer at the entrance.</PreviewNote>
    </>
  );
}
