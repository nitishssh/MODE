"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import type { Announcement, AnnouncementOutboxMessage } from "@/lib/contracts";
import { api, describeError, useLoad } from "../../../_lib/api";
import { dateTime, relative } from "../../../_lib/format";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";

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
    <Card title="Simulated outbox" actions={state.status === "ready" ? <Button size="sm" onClick={() => void load()}><Icon.refresh />Reload</Button> : null}>
      <p className="mx-muted mx-small" style={{ marginBottom: 12 }}>One stored row per active member at publication time. A row proves what was recorded, not that any email or message was delivered: nothing is sent externally.</p>
      {state.status === "idle" ? <Button onClick={() => void load()}><Icon.mail />Load recipients</Button> : null}
      {state.status === "loading" ? <Skeleton rows={4} /> : null}
      {state.status === "error" ? <Alert tone="error" onRetry={() => void load()}>{state.error}</Alert> : null}
      {state.status === "ready" && state.data ? (
        state.data.messages.length ? (
          <Table head={<><th>Recipient</th><th>Subject</th><th>Recorded</th><th>Status</th></>}>
            {state.data.messages.map((message) => (
              <tr key={message.id}>
                <td className="mx-mono" style={{ fontSize: 12 }}>{message.recipientEmail}</td>
                <td>{message.subject}</td>
                <td>{dateTime(message.createdAt)}</td>
                <td><Badge tone="blue" dot>{message.status}</Badge></td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState title="No recipients recorded">No member had an active membership when this was published.</EmptyState>
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
      <div className="mx-mb"><LinkButton href="/app/announcements" size="sm" variant="ghost"><Icon.back />All announcements</LinkButton></div>
      {announcement.loading && !item ? <Skeleton rows={6} /> : announcement.error ? <ErrorState error={announcement.error} onRetry={announcement.reload} fallback="This announcement could not be found." /> : item ? (
        <div className="mx-stack">
          <PageHead eyebrow={`Published ${relative(item.publishedAt)} · ${dateTime(item.publishedAt)}`} title={item.title} />
          <Card><p className="mx-prose" style={{ fontSize: 15 }}>{item.body}</p></Card>
          {can("outbox:manage") ? <OutboxCard id={item.id} /> : null}
        </div>
      ) : null}
    </>
  );
}
