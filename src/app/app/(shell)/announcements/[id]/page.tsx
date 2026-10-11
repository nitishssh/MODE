"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Announcement, AnnouncementOutboxMessage } from "@/lib/contracts";
import { api, useLoad } from "../../../_lib/api";
import { useT } from "../../../_lib/i18n";
import { Alert, Button, Card, EmptyState, ErrorState, Loading, PageHead, Skeleton, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";

/* One announcement as Azman's announcement-card, with the simulated outbox for outbox:manage holders. */

type OutboxResponse = { delivery: "simulated"; messages: AnnouncementOutboxMessage[] };

function OutboxCard({ id }: { id: string }) {
  const { t, fmt, apiError } = useT();
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; data?: OutboxResponse; error?: string }>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const data = await api.get<OutboxResponse>(`/api/announcements/${encodeURIComponent(id)}/outbox`);
      setState({ status: "ready", data });
    } catch (caught) {
      setState({ status: "error", error: apiError(caught) || t("announcements.outbox.loadError") });
    }
  }

  return (
    <Card kicker={t("announcements.outbox.kicker")} title={t("announcements.outbox.title")} flush actions={state.status === "ready" ? <button type="button" className="text-button" onClick={() => void load()}>{t("announcements.outbox.reload")} <Icon name="arrow" size={14} /></button> : null}>
      <div className="panel-footnote"><span className="tiny-dot" />{t("announcements.outbox.footnote")}</div>
      {state.status === "idle" ? <div style={{ padding: 25 }}><Button variant="primary" onClick={() => void load()}><Icon name="mail" size={16} />{t("announcements.outbox.load")}</Button></div> : null}
      {state.status === "loading" ? <div style={{ padding: 25 }}><Skeleton rows={4} /></div> : null}
      {state.status === "error" ? <div style={{ padding: 25 }}><Alert tone="error" onRetry={() => void load()}>{state.error}</Alert></div> : null}
      {state.status === "ready" && state.data ? (
        state.data.messages.length ? (
          <Table head={<><th scope="col">{t("announcements.outbox.recipient")}</th><th scope="col">{t("announcements.outbox.subject")}</th><th scope="col">{t("announcements.outbox.recorded")}</th><th scope="col">{t("col.status")}</th></>}>
            {state.data.messages.map((message) => (
              <tr key={message.id}>
                <td><strong>{message.recipientEmail}</strong></td>
                <td>{message.subject}</td>
                <td>{fmt.dateTime(message.createdAt)}</td>
                <td><span className="badge purple">{t("status.simulated")}</span></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState title={t("announcements.outbox.empty")} icon="mail">{t("announcements.outbox.emptyBody")}</EmptyState>
      ) : null}
    </Card>
  );
}

export default function AnnouncementPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { can } = useSession();
  const { t, fmt } = useT();
  const announcement = useLoad(() => api.get<{ announcement: Announcement }>(`/api/announcements/${encodeURIComponent(id)}`), [id]);
  const item = announcement.data?.announcement;

  return (
    <>
      <PageHead eyebrow={<>{t("announcements.eyebrow.club")} <span>/</span> {t("announcements.eyebrow.section")}</>} title={item ? item.title : t("announcements.detail.title")} description={item ? t("announcements.detail.publishedAt", { when: fmt.dateTime(item.publishedAt) }) : undefined} actions={<Link href="/app/announcements" className="text-button"><Icon name="back" size={14} />{t("announcements.detail.all")}</Link>} />
      {announcement.loading && !item ? <Loading label={t("announcements.detail.loading")} /> : announcement.error ? <ErrorState error={announcement.error} onRetry={announcement.reload} fallback="announcements.detail.notFound" title={t("announcements.detail.unavailable")} /> : item ? (
        <div className="announcement-list">
          <article className="panel announcement-card">
            <span className="announcement-symbol"><Icon name="megaphone" size={22} /></span>
            <div>
              <span className="eyebrow">{fmt.date(item.publishedAt)}</span>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </div>
          </article>
          {can("outbox:manage") ? <OutboxCard id={item.id} /> : null}
        </div>
      ) : null}
    </>
  );
}
