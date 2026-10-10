"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { dateTime, money } from "../../_lib/format";
import { Alert, EmptyState, ErrorState, LinkButton, PageHead, Progress, Skeleton, StatusBadge, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type Tab = "upcoming" | "past" | "drafts";

function EventCard({ event, href, door }: { event: EventDetails; href: string; door: boolean }) {
  const used = event.capacity > 0 ? ((event.capacity - event.available) / event.capacity) * 100 : 0;
  return (
    <Link href={href} className="mx-card" style={{ display: "block" }}>
      <div className="mx-between" style={{ marginBottom: 8 }}>
        <h2 className="mx-h3" style={{ fontFamily: "var(--mx-display)", fontSize: 20 }}>{event.title}</h2>
        {event.status !== "published" ? <StatusBadge status={event.status} /> : null}
      </div>
      <p className="mx-muted mx-small"><Icon.calendar style={{ width: 13, height: 13, verticalAlign: -2 }} /> {dateTime(event.startsAt)}</p>
      <p className="mx-muted mx-small" style={{ marginTop: 2 }}>{event.venue}</p>
      <div style={{ margin: "14px 0 6px" }}><Progress value={used} tone={event.available === 0 ? "accent" : undefined} /></div>
      <p className="mx-small"><span className="mx-strong">{event.available}</span> of {event.capacity} seats left</p>
      <div className="mx-between" style={{ marginTop: 14 }}>
        <span className="mx-small"><span className="mx-muted">Member</span> <span className="mx-strong">{money(event.memberPricePaise)}</span> · <span className="mx-muted">Guest</span> <span className="mx-strong">{money(event.guestPricePaise)}</span></span>
        <span className="mx-link mx-small">{door ? "Open door" : "Details"} →</span>
      </div>
    </Link>
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
        eyebrow="Events"
        title={door ? "Door scanner" : "Events"}
        description={door ? "Pick the event you are admitting people to." : "Tickets hold a seat for 30 minutes until an officer confirms payment at the desk."}
        actions={can("events:write") && !door ? <LinkButton href="/app/events/new" variant="primary"><Icon.plus />New event</LinkButton> : null}
      />
      {door ? <div className="mx-mb"><Alert tone="info">Choose an event below to open its scanner. Admission depends on a paid ticket for that event only.</Alert></div> : null}
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {events.error ? <ErrorState error={events.error} onRetry={events.reload} /> : events.loading && !events.data ? <Skeleton rows={6} /> : !list.length ? (
        <EmptyState title={tab === "upcoming" ? "No upcoming events" : tab === "past" ? "No past events" : "No drafts or cancelled events"}>
          {tab === "upcoming" && can("events:write") ? "Create one to open bookings." : tab === "upcoming" ? "Check back soon." : null}
        </EmptyState>
      ) : (
        <div className="mx-grid mx-grid-3">
          {list.map((event) => <EventCard key={event.id} event={event} door={door} href={door ? `/app/events/${event.id}/door` : `/app/events/${event.id}`} />)}
        </div>
      )}
    </>
  );
}

export default function EventsPage() {
  return <Suspense fallback={<Skeleton rows={6} />}><EventsList /></Suspense>;
}
