"use client";

import { useState } from "react";
import Link from "next/link";
import type { Notification } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { date, relative, titleCase } from "../../_lib/format";
import { Button, EmptyState, ErrorState, PageHead, PreviewNote, Skeleton, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type Filter = "all" | "announcement" | "dues";

function matches(filter: Filter, n: Notification): boolean {
  if (filter === "all") return true;
  if (filter === "announcement") return n.kind === "announcement";
  return n.kind !== "announcement";
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const notifications = useLoad(() => api.get<{ notifications: Notification[] }>("/api/notifications"));
  const all = [...(notifications.data?.notifications ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = all.filter((n) => matches(filter, n));
  const unread = all.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHead
        eyebrow={<>YOU <span>/</span> NOTIFICATIONS</>}
        title="Notifications"
        description={unread ? `${unread} unread. Announcements and dues reminders sent to you.` : "Announcements and dues reminders sent to you."}
        actions={<Button onClick={() => void notifications.reload()} loading={notifications.loading && Boolean(notifications.data)}><Icon name="clock" size={16} />Refresh</Button>}
      />

      <Tabs value={filter} onChange={setFilter} items={[
        { value: "all", label: "All", count: all.length },
        { value: "announcement", label: "Announcements", count: all.filter((n) => n.kind === "announcement").length },
        { value: "dues", label: "Dues", count: all.filter((n) => n.kind !== "announcement").length },
      ]} />

      {notifications.loading && !notifications.data ? <Skeleton rows={5} /> : notifications.error ? <ErrorState error={notifications.error} onRetry={notifications.reload} /> : !visible.length ? (
        <section className="panel"><EmptyState title={all.length ? "Nothing in this filter" : "No notifications yet"} icon="megaphone">{all.length ? "Try another filter." : "Published announcements and renewal reminders will appear here."}</EmptyState></section>
      ) : (
        <div className="announcement-list">
          {visible.map((n) => (
            <article key={n.id} className="panel announcement-card">
              <span className="announcement-symbol"><Icon name={n.kind === "announcement" ? "megaphone" : "coin"} size={22} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mx-row">
                  <span className="eyebrow">{date(n.createdAt)} · {relative(n.createdAt)}</span>
                  <span className={`badge ${n.kind === "announcement" ? "purple" : "amber"}`}>{titleCase(n.kind)}</span>
                  {!n.readAt ? <span className="badge green">New</span> : null}
                </div>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                {n.announcementId ? <Link href={`/app/announcements/${n.announcementId}`} className="text-button" style={{ marginTop: 10 }}>Read the announcement<Icon name="arrow" size={16} /></Link> : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <PreviewNote>Notifications are in-app only. The matching outbox rows are simulated; no email or WhatsApp is sent.</PreviewNote>
    </>
  );
}
