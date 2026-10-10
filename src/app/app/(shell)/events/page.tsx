"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { dateTime, money } from "../../_lib/format";
import { Button, EmptyState, ErrorState, PageHead, PreviewNote, Skeleton, StatusBadge, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's Events section: .event-cards grid of .panel.event-card articles. */

type Tab = "upcoming" | "past" | "drafts";

function monthShort(iso: string) { return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)).toUpperCase(); }
function dayOfMonth(iso: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)); }

function EventCard({ event, href, door, index }: { event: EventDetails; href: string; door: boolean; index: number }) {
  const used = event.capacity > 0 ? Math.min(100, ((event.capacity - event.available) / event.capacity) * 100) : 0;
  return (
    <article className="panel event-card">
      <div className="event-card-top">
        <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}>
          <span>{monthShort(event.startsAt)}</span>
          <strong>{dayOfMonth(event.startsAt)}</strong>
        </div>
        {event.status === "published"
          ? <span className={`badge ${event.available === 0 ? "amber" : "green"}`}>{event.available === 0 ? "Sold out" : "Bookings open"}</span>
          : <StatusBadge status={event.status} />}
      </div>
      <h2>{event.title}</h2>
      <p>{event.venue} · {dateTime(event.startsAt)}</p>
      <div className="capacity-bar"><span style={{ width: `${used}%` }} /></div>
      <div className="event-numbers">
        <span>{event.capacity - event.available} registered</span>
        <span>{event.available} of {event.capacity} seats left</span>
      </div>
      <div className="ticket-prices">
        <div><span>Member ticket</span><strong>{money(event.memberPricePaise)}</strong></div>
        <div><span>Guest ticket</span><strong>{money(event.guestPricePaise)}</strong></div>
      </div>
      <div className="mx-row mx-mt">
        <Link href={href} className="text-button">{door ? "Open door scanner" : "Details"}<Icon name="arrow" size={16} /></Link>
      </div>
    </article>
  );
}

function EventsList() {
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
    { value: "upcoming", label: "Upcoming", count: upcoming.length },
    { value: "past", label: "Past", count: past.length },
  ];
  if (can("events:write")) tabs.push({ value: "drafts", label: "Drafts & cancelled", count: drafts.length });

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> {door ? "DOOR SCANNER" : "EVENTS"}</>}
        title={door ? "Door scanner" : "Events"}
        description={door ? "Pick the event you are admitting people to." : "Tickets hold a seat for 30 minutes until an officer confirms payment at the desk."}
        actions={can("events:write") && !door ? <Link href="/app/events/new" className="button primary"><Icon name="plus" size={18} />New event</Link> : null}
      />
      {door ? (
        <div className="outstanding-notice">
          <Icon name="scan" size={16} />
          <div><strong>Choose an event below to open its scanner.</strong><p>Admission depends on a paid ticket for that event only.</p></div>
        </div>
      ) : null}
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {events.error ? <ErrorState error={events.error} onRetry={events.reload} /> : events.loading && !events.data ? <Skeleton rows={6} /> : !list.length ? (
        <section className="panel">
          <EmptyState title={tab === "upcoming" ? "No upcoming events" : tab === "past" ? "No past events" : "No drafts or cancelled events"} icon="calendar" action={tab === "upcoming" && can("events:write") ? <Button variant="primary" onClick={() => { window.location.href = "/app/events/new"; }}>Create an event</Button> : undefined}>
            {tab === "upcoming" && can("events:write") ? "Create one to open bookings." : tab === "upcoming" ? "Check back soon." : "Drafts and cancelled events will show here."}
          </EmptyState>
        </section>
      ) : (
        <div className="event-cards">
          {list.map((event, index) => <EventCard key={event.id} event={event} index={index} door={door} href={door ? `/app/events/${event.id}/door` : `/app/events/${event.id}`} />)}
        </div>
      )}
      <PreviewNote>Members with active dues pay the member price; everyone else pays the guest price. Prices are fixed when the seat is booked.</PreviewNote>
    </>
  );
}

export default function EventsPage() {
  return <Suspense fallback={<Skeleton rows={6} />}><EventsList /></Suspense>;
}
