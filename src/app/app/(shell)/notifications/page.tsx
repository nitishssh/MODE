"use client";

import { useState } from "react";
import Link from "next/link";
import type { Notification } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { relative, titleCase } from "../../_lib/format";
import { Badge, Button, EmptyState, ErrorState, PageHead, Segmented, Skeleton } from "../../_components/ui";
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
        eyebrow="You"
        title="Notifications"
        description={unread ? `${unread} unread. Announcements and dues reminders sent to you.` : "Announcements and dues reminders sent to you."}
        actions={<Button onClick={() => void notifications.reload()} loading={notifications.loading && Boolean(notifications.data)}><Icon.refresh />Refresh</Button>}
      />

      <div className="mx-toolbar">
        <Segmented value={filter} onChange={setFilter} items={[
          { value: "all", label: `All · ${all.length}` },
          { value: "announcement", label: `Announcements · ${all.filter((n) => n.kind === "announcement").length}` },
          { value: "dues", label: `Dues · ${all.filter((n) => n.kind !== "announcement").length}` },
        ]} />
      </div>

      {notifications.loading && !notifications.data ? <Skeleton rows={5} /> : notifications.error ? <ErrorState error={notifications.error} onRetry={notifications.reload} /> : !visible.length ? (
        <EmptyState title={all.length ? "Nothing in this filter" : "No notifications yet"}>{all.length ? "Try another filter." : "Published announcements and renewal reminders will appear here."}</EmptyState>
      ) : (
        <div className="mx-stack-sm">
          {visible.map((n) => {
            const body = (
              <>
                <div className="mx-between">
                  <div className="mx-row">
                    <Badge tone={n.kind === "announcement" ? "accent" : "amber"}>{titleCase(n.kind)}</Badge>
                    {!n.readAt ? <Badge tone="blue" dot>New</Badge> : null}
                  </div>
                  <span className="mx-muted mx-small">{relative(n.createdAt)}</span>
                </div>
                <h2 className="mx-h3" style={{ marginTop: 8 }}>{n.title}</h2>
                <p className="mx-prose mx-small" style={{ marginTop: 4 }}>{n.body}</p>
                {n.announcementId ? <span className="mx-link mx-small" style={{ display: "inline-block", marginTop: 8 }}>Read the announcement →</span> : null}
              </>
            );
            return n.announcementId
              ? <Link key={n.id} href={`/app/announcements/${n.announcementId}`} className="mx-card mx-card-tight" style={{ display: "block" }}>{body}</Link>
              : <article key={n.id} className="mx-card mx-card-tight">{body}</article>;
          })}
        </div>
      )}
    </>
  );
}
