"use client";

import { useState, type FormEvent } from "react";
import type { WhatsAppDelivery, WhatsAppGroup, WhatsAppPreference } from "@/lib/contracts";
import { api, describeError, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { Alert, Button, Card, ErrorState, Skeleton } from "../../_components/ui";

export function WhatsAppSettings() {
  const { can } = useSession();
  const state = useLoad(() => api.get<{ preferences: WhatsAppPreference; senderReady: boolean }>("/api/whatsapp/preferences"));
  return <>
    <Card title="WhatsApp notifications" kicker="YOUR CHOICES">
      <p>Receive club announcements and your membership renewal reminders on WhatsApp. Your number stays out of the public member directory.</p>
      <Alert tone="info">WhatsApp sending is not connected yet. You can save preferences now; eligible updates will wait in the queue.</Alert>
      {state.loading && !state.data ? <Skeleton rows={2} /> : state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : state.data ?
        <DestinationForm mode="member" initialValue={state.data.preferences.phone} initialEnabled={state.data.preferences.enabled} /> : null}
    </Card>
    {can("outbox:manage") ? <GroupSettings /> : null}
  </>;
}

function DestinationForm({ mode, initialValue, initialEnabled }: { mode: "member" | "group"; initialValue: string | null; initialEnabled: boolean }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice(""); setError("");
    try {
      await api.put(`/api/whatsapp/${mode === "member" ? "preferences" : "group"}`, mode === "member"
        ? { phone: value.trim() || null, enabled } : { destination: value.trim() || null, enabled });
      setNotice("Saved. WhatsApp sending is not connected yet.");
    } catch (caught) { setError(describeError(caught, "Could not save WhatsApp settings.")); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="task-create-panel" style={{ marginTop: 16 }}>
    {notice ? <Alert tone="success">{notice}</Alert> : null}
    {error ? <Alert tone="error">{error}</Alert> : null}
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="task-form-grid">
        <label>{mode === "member" ? "Your WhatsApp number" : "OpenWA group destination"}
          <input type={mode === "member" ? "tel" : "text"} autoComplete={mode === "member" ? "tel" : "off"}
            value={value} onChange={(event) => setValue(event.target.value)} maxLength={mode === "member" ? 16 : 256}
            placeholder={mode === "member" ? "+919876543210" : "Group identifier from OpenWA"} required={enabled} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          {mode === "member" ? "Allow WhatsApp announcements and private renewal reminders" : "Queue club announcements for this group"}
        </label>
      </div>
      <p className="mx-muted mx-small">{mode === "member"
        ? "When sending is connected, your number and notification text will be processed through OpenWA and WhatsApp. Turning this off cancels pending messages; a message already being sent may still arrive."
        : "Only published announcements go to the group. Personal membership reminders stay private. Changing the group cancels pending messages for the old destination."}</p>
      <div className="form-actions"><Button type="submit" loading={busy}>Save {mode === "member" ? "preferences" : "group"}</Button></div>
    </fieldset>
  </form>;
}

function GroupSettings() {
  const group = useLoad(() => api.get<{ group: WhatsAppGroup }>("/api/whatsapp/group"));
  const queue = useLoad(() => api.get<{ deliveries: WhatsAppDelivery[] }>("/api/whatsapp/deliveries"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function retry(id: string) {
    setBusy(id); setError("");
    try { await api.post(`/api/whatsapp/deliveries/${encodeURIComponent(id)}/retry`); await queue.reload(); }
    catch (caught) { setError(describeError(caught, "Could not retry this message.")); }
    finally { setBusy(null); }
  }
  return <Card title="Club WhatsApp group" kicker="OFFICER CONTROLS">
    {group.loading && !group.data ? <Skeleton rows={2} /> : group.error ? <ErrorState error={group.error} onRetry={group.reload} /> : group.data ?
      <DestinationForm mode="group" initialValue={group.data.group.destination} initialEnabled={group.data.group.enabled} /> : null}
    <div className="panel-heading" style={{ marginTop: 20 }}><h3>Latest 100 deliveries</h3><Button onClick={() => void queue.reload()} loading={queue.loading}>Refresh</Button></div>
    <p className="mx-muted mx-small">Accepted means the provider accepted a message, not that it was delivered or read. Uncertain sends need review before any resend.</p>
    {error ? <Alert tone="error">{error}</Alert> : null}
    {queue.error ? <ErrorState error={queue.error} onRetry={queue.reload} /> : !queue.data ? <Skeleton rows={2} /> : !queue.data.deliveries.length ? <p>No WhatsApp messages queued yet.</p> :
      <ul>{queue.data.deliveries.map((item) => <li key={item.id} style={{ marginBlock: 12 }}>
        {item.kind === "announcement" ? "Announcement" : "Renewal reminder"} · {item.audience} · <strong>{item.status}</strong> · {item.attempts} attempt(s)
        {item.status === "failed" && item.attempts < 3 ? <Button disabled={busy !== null} loading={busy === item.id} onClick={() => void retry(item.id)}>Retry</Button> : null}
      </li>)}</ul>}
  </Card>;
}
