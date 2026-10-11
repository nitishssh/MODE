"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";
import { Button, EmptyState, ErrorState, PageHead, PreviewNote, Skeleton, StatusBadge, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's Events section: .event-cards grid of .panel.event-card articles. */

type Tab = "upcoming" | "past" | "drafts";

function EventCard({ event, href, door, index }: { event: EventDetails; href: string; door: boolean; index: number }) {
  const { t, fmt } = useT();
  const used = event.capacity > 0 ? Math.min(100, ((event.capacity - event.available) / event.capacity) * 100) : 0;
  return (
    <article className="panel event-card">
      <div className="event-card-top">
        <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}>
          <span>{fmt.month(event.startsAt).toUpperCase()}</span>
          <strong>{fmt.day(event.startsAt)}</strong>
        </div>
        {event.status === "published"
          ? <span className={`badge ${event.available === 0 ? "amber" : "green"}`}>{event.available === 0 ? t("events.card.soldOut") : t("events.card.bookingsOpen")}</span>
          : <StatusBadge status={event.status} />}
      </div>
      <h2>{event.title}</h2>
      <p>{event.venue} · {fmt.dateTime(event.startsAt)}</p>
      <div className="capacity-bar"><span style={{ width: `${used}%` }} /></div>
      <div className="event-numbers">
        <span>{t("events.card.registered", { count: event.capacity - event.available })}</span>
        <span>{t("events.card.seatsLeft", { available: event.available, capacity: event.capacity })}</span>
      </div>
      <div className="ticket-prices">
        <div><span>{t("events.card.memberTicket")}</span><strong>{event.memberPricePaise === 0 ? t("state.free") : fmt.currency(event.memberPricePaise)}</strong></div>
        <div><span>{t("events.card.guestTicket")}</span><strong>{event.guestPricePaise === 0 ? t("state.free") : fmt.currency(event.guestPricePaise)}</strong></div>
      </div>
      <div className="mx-row mx-mt">
        <Link href={href} className="text-button">{door ? t("events.card.openDoor") : t("action.details")}<Icon name="arrow" size={16} /></Link>
      </div>
    </article>
  );
}

function EventsList() {
  const { t } = useT();
  const { can } = useSession();
  const params = useSearchParams();
  const door = params.get("door") === "1" && can("tickets:check_in");
  const [tab, setTab] = useState<Tab>("upcoming");
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));

  const now = Date.now();
  const all = events.data?.events ?? [];
  const published = all.filter((e) => e.status === "published");
  const upcoming = published.filter((e) => new Date(e.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = published.filter((e) => new Date(e.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const drafts = all.filter((e) => e.status !== "published");
  const list = tab === "upcoming" ? upcoming : tab === "past" ? past : drafts;

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "upcoming", label: t("events.tabs.upcoming"), count: upcoming.length },
    { value: "past", label: t("events.tabs.past"), count: past.length },
  ];
  if (can("events:write")) tabs.push({ value: "drafts", label: t("events.tabs.drafts"), count: drafts.length });

  const emptyTitle = tab === "upcoming" ? t("events.empty.upcoming") : tab === "past" ? t("events.empty.past") : t("events.empty.drafts");
  const emptyBody = tab === "upcoming" && can("events:write") ? t("events.empty.createHint") : tab === "upcoming" ? t("events.empty.checkBack") : t("events.empty.draftsHint");

  return (
    <>
      <PageHead
        eyebrow={<>{t("events.eyebrowClub")} <span>/</span> {door ? t("events.door.eyebrow") : t("events.eyebrow")}</>}
        title={door ? t("events.door.pickTitle") : t("events.title")}
        description={door ? t("events.door.pickDescription") : t("events.description")}
        actions={can("events:write") && !door ? <Link href="/app/events/new" className="button primary"><Icon name="plus" size={18} />{t("events.new")}</Link> : null}
      />
      {door ? (
        <div className="outstanding-notice">
          <Icon name="scan" size={16} />
          <div><strong>{t("events.door.chooseTitle")}</strong><p>{t("events.door.chooseBody")}</p></div>
        </div>
      ) : null}
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {events.error ? <ErrorState error={events.error} onRetry={events.reload} /> : events.loading && !events.data ? <Skeleton rows={6} /> : !list.length ? (
        <section className="panel">
          <EmptyState title={emptyTitle} icon="calendar" action={tab === "upcoming" && can("events:write") ? <Button variant="primary" onClick={() => { window.location.href = "/app/events/new"; }}>{t("events.empty.createCta")}</Button> : undefined}>
            {emptyBody}
          </EmptyState>
        </section>
      ) : (
        <div className="event-cards">
          {list.map((event, index) => <EventCard key={event.id} event={event} index={index} door={door} href={door ? `/app/events/${event.id}/door` : `/app/events/${event.id}`} />)}
        </div>
      )}
      <PreviewNote>{t("events.note.pricing")}</PreviewNote>
    </>
  );
}

export default function EventsPage() {
  return <Suspense fallback={<Skeleton rows={6} />}><EventsList /></Suspense>;
}
