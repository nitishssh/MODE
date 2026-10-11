"use client";

import { useState } from "react";
import Link from "next/link";
import type { Notification } from "@/lib/contracts";
import { api, useLoad } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { Button, EmptyState, ErrorState, PageHead, PreviewNote, Skeleton, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type Filter = "all" | "announcement" | "dues";

function matches(filter: Filter, n: Notification): boolean {
  if (filter === "all") return true;
  if (filter === "announcement") return n.kind === "announcement";
  return n.kind !== "announcement";
}

export default function NotificationsPage() {
  const { t, fmt } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const notifications = useLoad(() => api.get<{ notifications: Notification[] }>("/api/notifications"));
  const all = [...(notifications.data?.notifications ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = all.filter((n) => matches(filter, n));
  const unread = all.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHead
        eyebrow={<>{t("notifications.kicker")} <span>/</span> {t("notifications.kickerSection")}</>}
        title={t("notifications.title")}
        description={unread ? t("notifications.ledeUnread", { count: unread }) : t("notifications.lede")}
        actions={<Button onClick={() => void notifications.reload()} loading={notifications.loading && Boolean(notifications.data)}><Icon name="clock" size={16} />{t("action.refresh")}</Button>}
      />

      <Tabs value={filter} onChange={setFilter} items={[
        { value: "all", label: t("notifications.tabAll"), count: all.length },
        { value: "announcement", label: t("notifications.tabAnnouncements"), count: all.filter((n) => n.kind === "announcement").length },
        { value: "dues", label: t("notifications.tabDues"), count: all.filter((n) => n.kind !== "announcement").length },
      ]} />

      {notifications.loading && !notifications.data ? <Skeleton rows={5} /> : notifications.error ? <ErrorState error={notifications.error} onRetry={notifications.reload} /> : !visible.length ? (
        <section className="panel"><EmptyState title={all.length ? t("notifications.emptyFilterTitle") : t("notifications.emptyTitle")} icon="megaphone">{all.length ? t("notifications.emptyFilterBody") : t("notifications.emptyBody")}</EmptyState></section>
      ) : (
        <div className="announcement-list">
          {visible.map((n) => (
            <article key={n.id} className="panel announcement-card">
              <span className="announcement-symbol"><Icon name={n.kind === "announcement" ? "megaphone" : "coin"} size={22} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mx-row">
                  <span className="eyebrow">{fmt.date(n.createdAt)} · {fmt.relative(n.createdAt)}</span>
                  <span className={`badge ${n.kind === "announcement" ? "purple" : "amber"}`}>{n.kind === "announcement" ? t("notifications.kind.announcement") : t("notifications.kind.dues")}</span>
                  {!n.readAt ? <span className="badge green">{t("notifications.new")}</span> : null}
                </div>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                {n.announcementId ? <Link href={`/app/announcements/${n.announcementId}`} className="text-button" style={{ marginTop: 10 }}>{t("notifications.readAnnouncement")}<Icon name="arrow" size={16} /></Link> : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <PreviewNote>{t("notifications.previewNote")}</PreviewNote>
    </>
  );
}
