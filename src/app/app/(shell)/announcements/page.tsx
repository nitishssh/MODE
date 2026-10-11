"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Announcement, AnnouncementPublication } from "@/lib/contracts";
import { api, ApiError, newId, useAction, useLoad } from "../../_lib/api";
import { date } from "../../_lib/format";
import { Alert, Button, EmptyState, ErrorState, FormPanel, Loading, PageHead, PreviewNote } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { useSession } from "../../_lib/session";

/* Azman's Announcements section: communication toolbar with search, the
 * announcement-card archive, plus an inline publish panel for officers. */

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

function PublishPanel({ onClose, onPublished }: { onClose: () => void; onPublished: (publication: AnnouncementPublication) => void }) {
  const [draft, setDraft] = useState<Draft>({ key: "", title: "", body: "" });
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [keyReused, setKeyReused] = useState(false);
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
        onPublished(publication);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "announcement_key_reused") setKeyReused(true);
        throw caught;
      }
    });
    if (ok) {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setDraft({ key: newId(), title: "", body: "" });
      onClose();
    }
  }

  const busy = action.busy === "publish";
  return (
    <FormPanel title="Publish an announcement" description="Publishing is immediate and creates one notification per active member. Corrections need a new announcement." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label style={{ gridColumn: "1 / -1" }}>Title<input value={draft.title} maxLength={160} placeholder="What members need to know" disabled={busy} onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setErrors((c) => ({ ...c, title: undefined })); }} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Message<textarea value={draft.body} maxLength={10000} rows={6} style={{ height: 150 }} placeholder="Plain text" disabled={busy} onChange={(e) => { setDraft((d) => ({ ...d, body: e.target.value })); setErrors((c) => ({ ...c, body: undefined })); }} /></label>
        </div>
        <p className="upload-progress">{draft.body.length.toLocaleString("en-IN")} / 10,000 characters. Drafts are kept in this browser until published.</p>
        {errors.title || errors.body ? <p className="form-error" role="alert">{[errors.title, errors.body].filter(Boolean).join(" ")}</p> : null}
        {action.error ? <p className="form-error" role="alert">{action.error}{keyReused ? <> <button type="button" className="text-button" onClick={freshDraft}>Start a fresh draft</button></> : null}</p> : null}
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={busy}><Icon name="megaphone" size={16} />{busy ? "Publishing…" : "Publish to active members"}</button>
          {draft.title || draft.body ? <button type="button" className="button secondary" disabled={busy} onClick={freshDraft}>Discard draft</button> : null}
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </FormPanel>
  );
}

export default function AnnouncementsPage() {
  const { can } = useSession();
  const announcements = useLoad(() => api.get<{ announcements: Announcement[] }>("/api/announcements"));
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [result, setResult] = useState<AnnouncementPublication | null>(null);

  const all = announcements.data?.announcements ?? [];
  const visible = all.filter((item) => {
    const q = query.trim().toLowerCase();
    return !q || `${item.title} ${item.body}`.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> NOTICES</>}
        title="Announcements"
        description="Dated archive of everything the club has published, newest first."
        actions={can("announcements:write") ? <Button variant="primary" onClick={() => { setShowForm(true); setResult(null); }}><Icon name="plus" size={18} />New announcement</Button> : null}
      />

      {result ? (
        <Alert tone="success" onDismiss={() => setResult(null)}>
          <strong>{result.created ? "Published" : "Already published"}:</strong> “{result.announcement.title}” reached {result.recipientCount} active member{result.recipientCount === 1 ? "" : "s"} in-app. Delivery is simulated: no email or WhatsApp is sent.
        </Alert>
      ) : null}

      {showForm && can("announcements:write") ? <PublishPanel onClose={() => setShowForm(false)} onPublished={(publication) => { setResult(publication); void announcements.reload(); }} /> : null}

      <div className="communication-toolbar">
        <div>
          <div className="eyebrow">ARCHIVE</div>
          <p className="communication-count">{visible.length} of {all.length} announcement{all.length === 1 ? "" : "s"}</p>
        </div>
        <label className="search-field">
          <span className="sr-only">Search announcements</span>
          <input type="search" value={query} placeholder="Search announcements" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      {announcements.loading && !announcements.data ? <Loading label="Opening the noticeboard…" /> : announcements.error ? <ErrorState error={announcements.error} onRetry={announcements.reload} title="The noticeboard could not load" /> : (
        <>
          <div className="announcement-list">
            {visible.map((item) => (
              <article key={item.id} className="panel announcement-card">
                <span className="announcement-symbol"><Icon name="megaphone" size={22} /></span>
                <div>
                  <span className="eyebrow">{date(item.publishedAt)}</span>
                  <h2><Link href={`/app/announcements/${encodeURIComponent(item.id)}`}>{item.title}</Link></h2>
                  <details className="announcement-details">
                    <summary>Read</summary>
                    <p>{item.body}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>
          {!visible.length ? (
            <section className="panel">
              <EmptyState title={all.length ? "No matching announcements" : "The noticeboard is quiet"} icon="megaphone">
                {all.length ? "Try a different search." : can("announcements:write") ? "Publish the first announcement with the button above." : "Published notices from the club appear here."}
              </EmptyState>
            </section>
          ) : null}
        </>
      )}
      <PreviewNote>Publication creates one in-app notification and one simulated outbox row per active member. No email or WhatsApp is sent.</PreviewNote>
    </>
  );
}
