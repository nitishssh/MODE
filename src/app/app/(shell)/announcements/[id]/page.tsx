"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Announcement, AnnouncementOutboxMessage } from "@/lib/contracts";
import { api, describeError, useLoad } from "../../../_lib/api";
import { date, dateTime } from "../../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, Loading, PageHead, Skeleton, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";

/* One announcement as Azman's announcement-card, with the simulated outbox for outbox:manage holders. */

type OutboxResponse = { delivery: "simulated"; messages: AnnouncementOutboxMessage[] };

function OutboxCard({ id }: { id: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; data?: OutboxResponse; error?: string }>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const data = await api.get<OutboxResponse>(`/api/announcements/${encodeURIComponent(id)}/outbox`);
      setState({ status: "ready", data });
    } catch (caught) {
      setState({ status: "error", error: describeError(caught, "Could not load the outbox.") });
    }
  }

  return (
    <Card kicker="SIMULATED DELIVERY" title="Outbox" flush actions={state.status === "ready" ? <button type="button" className="text-button" onClick={() => void load()}>Reload <Icon name="arrow" size={14} /></button> : null}>
      <div className="panel-footnote"><span className="tiny-dot" />One stored row per active member at publication time. A row proves what was recorded, not that any email or message was delivered: nothing is sent externally.</div>
      {state.status === "idle" ? <div style={{ padding: 25 }}><Button variant="primary" onClick={() => void load()}><Icon name="mail" size={16} />Load recipients</Button></div> : null}
      {state.status === "loading" ? <div style={{ padding: 25 }}><Skeleton rows={4} /></div> : null}
      {state.status === "error" ? <div style={{ padding: 25 }}><Alert tone="error" onRetry={() => void load()}>{state.error}</Alert></div> : null}
      {state.status === "ready" && state.data ? (
        state.data.messages.length ? (
          <Table head={<><th scope="col">Recipient</th><th scope="col">Subject</th><th scope="col">Recorded</th><th scope="col">Status</th></>}>
            {state.data.messages.map((message) => (
              <tr key={message.id}>
                <td><strong>{message.recipientEmail}</strong></td>
                <td>{message.subject}</td>
                <td>{dateTime(message.createdAt)}</td>
                <td><span className="badge purple">{message.status}</span></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState title="No recipients recorded" icon="mail">No member had an active membership when this was published.</EmptyState>
      ) : null}
    </Card>
  );
}

export default function AnnouncementPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { can } = useSession();
  const announcement = useLoad(() => api.get<{ announcement: Announcement }>(`/api/announcements/${encodeURIComponent(id)}`), [id]);
  const item = announcement.data?.announcement;

  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> NOTICES</>} title={item ? item.title : "Announcement"} description={item ? `Published ${dateTime(item.publishedAt)}` : undefined} actions={<Link href="/app/announcements" className="text-button"><Icon name="back" size={14} />All announcements</Link>} />
      {announcement.loading && !item ? <Loading label="Opening the notice…" /> : announcement.error ? <ErrorState error={announcement.error} onRetry={announcement.reload} fallback="This announcement could not be found." title="Announcement unavailable" /> : item ? (
        <div className="announcement-list">
          <article className="panel announcement-card">
            <span className="announcement-symbol"><Icon name="megaphone" size={22} /></span>
            <div>
              <span className="eyebrow">{date(item.publishedAt)}</span>
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
