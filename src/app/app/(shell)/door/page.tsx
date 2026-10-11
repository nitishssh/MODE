"use client";

import Link from "next/link";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { Icon } from "../../_components/icons";
import { EmptyState, ErrorState, PageHead, Skeleton } from "../../_components/ui";

/* The door volunteer's landing: pick the event, open its scanner. Nothing else. */

export default function DoorHomePage() {
  const { t, fmt } = useT();
  const { can } = useSession();
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));

  if (!can("tickets:check_in")) {
    return <section className="panel"><EmptyState title={t("events.door.volunteersOnly")} icon="scan">{t("events.door.needsPermission")}</EmptyState></section>;
  }

  const now = Date.now();
  const list = (events.data?.events ?? [])
    .filter((event) => event.status === "published")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .sort((a, b) => Number(new Date(b.startsAt).getTime() < now) - Number(new Date(a.startsAt).getTime() < now));

  return (
    <>
      <PageHead eyebrow={<>{t("events.eyebrowClub")} <span>/</span> {t("events.door.eyebrow")}</>} title={t("events.door.pickTitle")} description={t("events.door.pickDescription")} />
      <div className="outstanding-notice">
        <Icon name="scan" size={16} />
        <div><strong>{t("events.door.chooseTitle")}</strong><p>{t("events.door.chooseBody")}</p></div>
      </div>
      {events.error ? <ErrorState error={events.error} onRetry={events.reload} /> : events.loading && !events.data ? <section className="panel"><div className="panel-body"><Skeleton rows={4} /></div></section> : !list.length ? (
        <section className="panel"><EmptyState title={t("events.empty.upcoming")} icon="calendar">{t("events.empty.checkBack")}</EmptyState></section>
      ) : (
        <section className="panel">
          <div className="event-list">
            {list.map((event, index) => (
              <Link key={event.id} href={`/app/events/${event.id}/door`} className="event-row">
                <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{fmt.month(event.startsAt)}</span><strong>{fmt.day(event.startsAt)}</strong></div>
                <div className="event-info">
                  <h3>{event.title}</h3>
                  <p>{fmt.dateTime(event.startsAt)} · {event.venue}</p>
                </div>
                <span className="text-button">{t("events.card.openDoor")}<Icon name="arrow" size={16} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
