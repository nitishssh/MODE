"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Announcement, AnnouncementPublication } from "@/lib/contracts";
import { api, ApiError, newId, useAction, useLoad } from "../../_lib/api";
import { dateTime, relative } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, PageHead, Skeleton, TextField, TextareaField } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { useSession } from "../../_lib/session";

const DRAFT_KEY = "mode.announcement.draft";

type Draft = { key: string; title: string; body: string };

function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      if (typeof parsed.key === "string" && parsed.key) return { key: parsed.key, title: parsed.title ?? "", body: parsed.body ?? "" };
    }
  } catch { /* ignore corrupt storage */ }
  return { key: newId(), title: "", body: "" };
}

function PublishCard({ onPublished }: { onPublished: (publication: AnnouncementPublication) => void }) {
  const [draft, setDraft] = useState<Draft>({ key: "", title: "", body: "" });
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [keyReused, setKeyReused] = useState(false);
  const [result, setResult] = useState<AnnouncementPublication | null>(null);
  const action = useAction();

  useEffect(() => { setDraft(loadDraft()); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage full or unavailable */ }
  }, [draft, ready]);

  function freshDraft() {
    setDraft({ key: newId(), title: "", body: "" });
    setKeyReused(false);
    setErrors({});
    action.clear();
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();
    const next: typeof errors = {};
    if (title.length < 3 || title.length > 160) next.title = "Title must be 3 to 160 characters.";
    if (!body.length || body.length > 10000) next.body = "Body must be 1 to 10,000 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!window.confirm("Publish now? This sends an in-app notice to every active member and cannot be edited afterwards.")) return;
    const ok = await action.run("publish", async () => {
      try {
        const publication = await api.post<AnnouncementPublication>("/api/announcements", { idempotencyKey: draft.key, title, body });
        setResult(publication);
        onPublished(publication);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "announcement_key_reused") setKeyReused(true);
        throw caught;
      }
    });
    if (ok) {
      setDraft({ key: newId(), title: "", body: "" });
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
  }

  return (
    <Card title="Publish an announcement">
      <form className="mx-form" onSubmit={submit} noValidate>
        {result ? (
          <Alert tone="success" onDismiss={() => setResult(null)}>
            <strong>{result.created ? "Published" : "Already published"}:</strong> “{result.announcement.title}” reached {result.recipientCount} active member{result.recipientCount === 1 ? "" : "s"} in-app. Delivery is simulated: no email or WhatsApp is sent.
          </Alert>
        ) : null}
        {action.error ? (
          <Alert tone="error" onDismiss={action.clear}>
            {action.error}
            {keyReused ? <div style={{ marginTop: 8 }}><Button size="sm" onClick={freshDraft}>Start a fresh draft</Button></div> : null}
          </Alert>
        ) : null}
        <TextField label="Title" value={draft.title} onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setErrors((c) => ({ ...c, title: undefined })); }} error={errors.title} maxLength={160} placeholder="What members need to know" />
        <TextareaField label="Message" value={draft.body} onChange={(e) => { setDraft((d) => ({ ...d, body: e.target.value })); setErrors((c) => ({ ...c, body: undefined })); }} error={errors.body} hint={`Plain text. ${draft.body.length.toLocaleString("en-IN")} / 10,000 characters. Drafts are kept in this browser until published.`} rows={6} maxLength={10000} />
        <div className="mx-form-actions">
          {draft.title || draft.body ? <Button variant="ghost" onClick={freshDraft}>Discard draft</Button> : null}
          <Button type="submit" variant="primary" loading={action.busy === "publish"}><Icon.megaphone />Publish to active members</Button>
        </div>
        <p className="mx-muted mx-small">Publishing is immediate and creates one notification per active member. Corrections need a new announcement.</p>
      </form>
    </Card>
  );
}

export default function AnnouncementsPage() {
  const { can } = useSession();
  const announcements = useLoad(() => api.get<{ announcements: Announcement[] }>("/api/announcements"));
  const rows = announcements.data?.announcements ?? [];

  const list = announcements.loading && !announcements.data ? <Skeleton rows={5} /> : announcements.error ? <ErrorState error={announcements.error} onRetry={announcements.reload} /> : !rows.length ? (
    <EmptyState title="No announcements yet">{can("announcements:write") ? "Publish the first one from the form." : "Published notices from the club appear here."}</EmptyState>
  ) : (
    <div className="mx-list">
      {rows.map((item) => (
        <Link key={item.id} href={`/app/announcements/${encodeURIComponent(item.id)}`} className="mx-list-item">
          <div className="mx-grow">
            <strong>{item.title}</strong>
            <small title={dateTime(item.publishedAt)}>{relative(item.publishedAt)}</small>
            <p className="mx-muted" style={{ marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.body.length > 160 ? `${item.body.slice(0, 160)}…` : item.body}</p>
          </div>
          <Icon.arrow style={{ color: "var(--mx-muted)" }} />
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Club notices" title="Announcements" description="Dated archive of everything the club has published, newest first." actions={<Button size="sm" onClick={() => void announcements.reload()} loading={announcements.loading && Boolean(announcements.data)}><Icon.refresh />Refresh</Button>} />
      {can("announcements:write") ? (
        <div className="mx-grid mx-grid-main">
          <Card title="Archive">{list}</Card>
          <PublishCard onPublished={() => void announcements.reload()} />
        </div>
      ) : <Card title="Archive">{list}</Card>}
    </>
  );
}
