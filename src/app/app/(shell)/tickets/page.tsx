"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventDetails, Ticket } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { Countdown, EmptyState, ErrorState, PageHead, PreviewNote, Segmented, Skeleton, StatusBadge, When } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { QrCode } from "../../_components/qr";

/* Tickets as .panel.event-card articles, in Azman's event-card rhythm. */

type View = "live" | "past";

function TicketCard({ ticket, event, reload, index }: { ticket: Ticket; event?: EventDetails; reload: () => Promise<void>; index: number }) {
  const { t, fmt, apiError } = useT();
  const action = useAction();
  const live = ticket.status === "pending_payment" || ticket.status === "paid";
  const pricing = ticket.pricing === "member" ? t("pricing.member") : t("pricing.guest");
  return (
    <article className="panel event-card">
      <div className="event-card-top">
        {event
          ? <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{fmt.month(event.startsAt).toUpperCase()}</span><strong>{fmt.day(event.startsAt)}</strong></div>
          : <div className="date-tile coral"><span>{t("tickets.eventTile")}</span><strong>?</strong></div>}
        <StatusBadge status={ticket.status} />
      </div>
      <h2>{event?.title ?? t("tickets.eventFallback")}</h2>
      <p>{event ? `${event.venue} · ${fmt.dateTime(event.startsAt)}` : t("tickets.detailsUnavailable")}</p>
      <div className="mx-row mx-mt" style={{ alignItems: "flex-start", gap: 20 }}>
        {live && ticket.qrToken ? <QrCode value={ticket.qrToken} alt={t("tickets.qrAlt", { code: ticket.shortCode })} size={150} /> : null}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="eyebrow">{t("events.detail.doorCode")}</div>
          <p className="mx-code-big" style={{ fontSize: 24 }}>{ticket.shortCode}</p>
          <div className="ticket-prices" style={{ gap: 30 }}>
            <div><span>{t("col.holder")}</span><strong style={{ fontSize: 14 }}>{ticket.holderName}</strong></div>
            <div><span>{t("tickets.rate", { pricing })}</span><strong>{ticket.pricePaise === 0 ? t("state.free") : fmt.currency(ticket.pricePaise)}</strong></div>
          </div>
          {ticket.status === "pending_payment" ? <p className="mx-small mx-mt"><span className="mx-muted">{t("tickets.holdExpiresIn")}</span> <Countdown until={ticket.holdExpiresAt} onExpire={() => void reload()} /></p> : null}
          {ticket.paidAt ? <p className="mx-small mx-mt"><span className="mx-muted">{t("events.detail.paid")}</span> <When iso={ticket.paidAt} /></p> : null}
          {ticket.checkedInAt ? <p className="mx-small"><span className="mx-muted">{t("events.detail.checkedIn")}</span> <When iso={ticket.checkedInAt} /></p> : null}
        </div>
      </div>
      {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
      <div className="mx-row mx-mt">
        <Link href={`/app/events/${ticket.eventId}`} className="text-button">{t("tickets.eventDetails")}<Icon name="arrow" size={16} /></Link>
        {ticket.status === "pending_payment" ? <button type="button" className="button-small red-btn" disabled={action.busy === ticket.id} onClick={() => void action.run(ticket.id, async () => {
          try { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); } catch (caught) { throw new Error(apiError(caught)); }
          await reload();
        })}>{action.busy === ticket.id ? t("events.detail.cancelling") : t("events.detail.cancelHold")}</button> : null}
      </div>
    </article>
  );
}

export default function MyTicketsPage() {
  const { t } = useT();
  const [view, setView] = useState<View>("live");
  const tickets = useLoad(() => api.get<{ tickets: Ticket[] }>("/api/tickets/mine"));
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));
  const byEvent = new Map((events.data?.events ?? []).map((e) => [e.id, e]));

  const all = tickets.data?.tickets ?? [];
  const live = all.filter((ticket) => ticket.status === "pending_payment" || ticket.status === "paid");
  const past = all.filter((ticket) => ticket.status === "cancelled" || ticket.status === "expired");
  const list = (view === "live" ? live : past).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHead
        eyebrow={<>{t("tickets.eyebrowYou")} <span>/</span> {t("tickets.eyebrow")}</>}
        title={t("tickets.title")}
        description={t("tickets.description")}
        actions={<Link href="/app/events" className="button primary"><Icon name="calendar" size={18} />{t("tickets.browse")}</Link>}
      />
      <div className="task-toolbar">
        <Segmented value={view} onChange={setView} items={[{ value: "live", label: t("tickets.live", { count: live.length }) }, { value: "past", label: t("tickets.past", { count: past.length }) }]} />
        <button type="button" className="text-button" onClick={() => void tickets.reload()}>{t("action.refresh")}<Icon name="refresh" size={14} /></button>
      </div>
      {tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : tickets.loading && !tickets.data ? <Skeleton rows={6} /> : !list.length ? (
        <section className="panel">
          <EmptyState title={view === "live" ? t("tickets.emptyLive") : t("tickets.emptyPast")} icon="ticket" action={view === "live" ? <Link href="/app/events" className="button primary">{t("tickets.findEvent")}</Link> : undefined}>
            {view === "live" ? t("tickets.emptyLiveBody") : t("tickets.emptyPastBody")}
          </EmptyState>
        </section>
      ) : (
        <div className="event-cards">
          {list.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} index={index} event={byEvent.get(ticket.eventId)} reload={tickets.reload} />)}
        </div>
      )}
      <PreviewNote>{t("tickets.note")}</PreviewNote>
    </>
  );
}
