"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { readOptionalPreference, writeOptionalPreference } from "@/lib/privacy-preferences";
import type { Announcement, AnnouncementPublication } from "@/lib/contracts";
import { api, ApiError, newId, useAction, useLoad } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { Alert, Button, EmptyState, ErrorState, FormPanel, Loading, PageHead, PreviewNote } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { useSession } from "../../_lib/session";

/* Azman's Announcements section: communication toolbar with search, the
 * announcement-card archive, plus an inline publish panel for officers. */

const DRAFT_KEY = "mode.announcement.draft";

type Draft = { key: string; title: string; body: string };

function loadDraft(): Draft {
  try {
    const raw = readOptionalPreference(DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      if (typeof parsed.key === "string" && parsed.key) return { key: parsed.key, title: parsed.title ?? "", body: parsed.body ?? "" };
    }
  } catch { /* ignore corrupt storage */ }
  return { key: newId(), title: "", body: "" };
}

function PublishPanel({ onClose, onPublished }: { onClose: () => void; onPublished: (publication: AnnouncementPublication) => void }) {
  const { t, fmt } = useT();
  // The panel only mounts after a click, so it can read the saved draft on first render.
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [keyReused, setKeyReused] = useState(false);
  const action = useAction();

  useEffect(() => {
    writeOptionalPreference(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

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
    if (title.length < 3 || title.length > 160) next.title = t("announcements.publish.titleError");
    if (!body.length || body.length > 10000) next.body = t("announcements.publish.bodyError");
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!window.confirm(t("announcements.publish.confirm"))) return;
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
    <FormPanel title={t("announcements.publish.title")} description={t("announcements.publish.description")} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label style={{ gridColumn: "1 / -1" }}>{t("announcements.publish.titleLabel")}<input value={draft.title} maxLength={160} placeholder={t("announcements.publish.titlePlaceholder")} disabled={busy} onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setErrors((c) => ({ ...c, title: undefined })); }} /></label>
          <label style={{ gridColumn: "1 / -1" }}>{t("announcements.publish.message")}<textarea value={draft.body} maxLength={10000} rows={6} style={{ height: 150 }} placeholder={t("announcements.publish.messagePlaceholder")} disabled={busy} onChange={(e) => { setDraft((d) => ({ ...d, body: e.target.value })); setErrors((c) => ({ ...c, body: undefined })); }} /></label>
        </div>
        <p className="upload-progress">{t("announcements.publish.counter", { count: fmt.number(draft.body.length) })} <Link href="/privacy">Manage privacy choices</Link></p>
        {errors.title || errors.body ? <p className="form-error" role="alert">{[errors.title, errors.body].filter(Boolean).join(" ")}</p> : null}
        {action.error ? <p className="form-error" role="alert">{action.error}{keyReused ? <> <button type="button" className="text-button" onClick={freshDraft}>{t("announcements.publish.freshDraft")}</button></> : null}</p> : null}
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={busy}><Icon name="megaphone" size={16} />{busy ? t("announcements.publish.publishing") : t("announcements.publish.submit")}</button>
          {draft.title || draft.body ? <button type="button" className="button secondary" disabled={busy} onClick={freshDraft}>{t("announcements.publish.discard")}</button> : null}
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>{t("action.cancel")}</button>
        </div>
      </form>
    </FormPanel>
  );
}

export default function AnnouncementsPage() {
  const { can } = useSession();
  const { t, fmt } = useT();
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
        eyebrow={<>{t("announcements.eyebrow.club")} <span>/</span> {t("announcements.eyebrow.section")}</>}
        title={t("announcements.title")}
        description={t("announcements.description")}
        actions={can("announcements:write") ? <Button variant="primary" onClick={() => { setShowForm(true); setResult(null); }}><Icon name="plus" size={18} />{t("announcements.new")}</Button> : null}
      />

      {result ? (
        <Alert tone="success" onDismiss={() => setResult(null)}>
          <strong>{result.created ? t("announcements.result.published") : t("announcements.result.alreadyPublished")}:</strong>{" "}
          {t(result.recipientCount === 1 ? "announcements.result.reach.one" : "announcements.result.reach.many", { title: result.announcement.title, count: result.recipientCount })}
        </Alert>
      ) : null}

      {showForm && can("announcements:write") ? <PublishPanel onClose={() => setShowForm(false)} onPublished={(publication) => { setResult(publication); void announcements.reload(); }} /> : null}

      <div className="communication-toolbar">
        <div>
          <div className="eyebrow">{t("announcements.archive")}</div>
          <p className="communication-count">{t(all.length === 1 ? "announcements.count.one" : "announcements.count.many", { visible: visible.length, total: all.length })}</p>
        </div>
        <label className="search-field">
          <span className="sr-only">{t("announcements.search")}</span>
          <input type="search" value={query} placeholder={t("announcements.search")} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      {announcements.loading && !announcements.data ? <Loading label={t("announcements.loading")} /> : announcements.error ? <ErrorState error={announcements.error} onRetry={announcements.reload} title={t("announcements.loadError")} /> : (
        <>
          <div className="announcement-list">
            {visible.map((item) => (
              <article key={item.id} className="panel announcement-card">
                <span className="announcement-symbol"><Icon name="megaphone" size={22} /></span>
                <div>
                  <span className="eyebrow">{fmt.date(item.publishedAt)}</span>
                  <h2><Link href={`/app/announcements/${encodeURIComponent(item.id)}`}>{item.title}</Link></h2>
                  <details className="announcement-details">
                    <summary>{t("announcements.read")}</summary>
                    <p>{item.body}</p>
                  </details>
                </div>
              </article>
            ))}
          </div>
          {!visible.length ? (
            <section className="panel">
              <EmptyState title={all.length ? t("announcements.empty.noMatch") : t("announcements.empty.quiet")} icon="megaphone">
                {all.length ? t("announcements.empty.differentSearch") : can("announcements:write") ? t("announcements.empty.publishFirst") : t("announcements.empty.none")}
              </EmptyState>
            </section>
          ) : null}
        </>
      )}
      <PreviewNote>{t("announcements.previewNote")}</PreviewNote>
    </>
  );
}
