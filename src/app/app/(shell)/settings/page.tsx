"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, useAction } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { useSession } from "../../_lib/session";
import { Alert, Button, Card, KeyValue, PageHead, PreviewNote, Skeleton, StatusBadge } from "../../_components/ui";
import { Icon } from "../../_components/icons";

export default function SettingsPage() {
  const { t } = useT();
  const session = useSession();
  const router = useRouter();
  const { user, pass } = session;
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return <Skeleton rows={5} />;

  async function signOut() {
    setSigningOut(true);
    try { await session.logout(); } catch { /* cookie logout is idempotent */ }
    router.replace("/app/login");
  }

  return (
    <>
      <PageHead
        eyebrow={<>{t("settings.kicker")} <span>/</span> {t("settings.kickerSection")}</>}
        title={t("settings.title")}
        description={t("settings.lede")}
        actions={<Button variant="danger" onClick={() => void signOut()} loading={signingOut}><Icon name="logout" size={16} />{t("action.signOut")}</Button>}
      />

      <div className="treasury-overview-grid">
        <div className="mx-stack">
          <Card kicker={t("settings.account.kicker")} title={t("settings.account.title")}>
            <KeyValue items={[
              { label: t("col.name"), value: user.name },
              { label: t("col.email"), value: user.email },
              { label: t("col.role"), value: <StatusBadge status={user.role} /> },
              { label: t("membership.label"), value: pass ? <StatusBadge status={pass.membership} label={pass.membership === "none" ? t("status.none") : undefined} /> : "—" },
            ]} />
            <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>{t("settings.account.permissions")}</div>
            <div className="mx-row" style={{ gap: 6 }}>
              {user.permissions.length ? user.permissions.map((p) => <span key={p} className="badge neutral">{p}</span>) : <span className="mx-muted mx-small">{t("settings.account.noPermissions")}</span>}
            </div>
          </Card>

          <section className="panel">
            <div className="panel-heading">
              <div><div className="eyebrow">{t("settings.interface.kicker")}</div><h2>{t("settings.interface.title")}</h2></div>
            </div>
            <div className="event-list">
              <Link href="/app/pass" className="event-row">
                <span className="announcement-symbol"><Icon name="coin" size={20} /></span>
                <div className="event-info"><h3>{t("settings.interface.pass")}</h3><p>{t("settings.interface.passHint")}</p></div>
                <Icon name="chevron" size={14} />
              </Link>
              <Link href="/app/notifications" className="event-row">
                <span className="announcement-symbol"><Icon name="megaphone" size={20} /></span>
                <div className="event-info"><h3>{t("settings.interface.notifications")}</h3><p>{t("settings.interface.notificationsHint")}</p></div>
                <Icon name="chevron" size={14} />
              </Link>
              <a href="/" className="event-row">
                <span className="announcement-symbol"><Icon name="grid" size={20} /></span>
                <div className="event-info"><h3>{t("settings.interface.legacy")}</h3><p>{t("settings.interface.legacyHint")}</p></div>
                <Icon name="chevron" size={14} />
              </a>
            </div>
          </section>
        </div>

        <PasswordCard />
      </div>

      <PreviewNote>{t("settings.previewNote")}</PreviewNote>
    </>
  );
}

function PasswordCard() {
  const { t, apiError } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const e: typeof errors = {};
    if (!current) e.current = t("settings.password.currentRequired");
    if (next.length < 8 || next.length > 200) e.next = t("settings.password.length");
    if (next && next === current) e.next = t("settings.password.sameAsCurrent");
    if (confirm !== next) e.confirm = t("settings.password.mismatch");
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await action.run("password", async () => {
      try {
        const result = await api.post<{ ok: true; revokedSessions: number }>("/api/auth/password", { currentPassword: current, newPassword: next });
        return result.revokedSessions > 0
          ? t("settings.password.changedRevoked", { count: result.revokedSessions })
          : t("settings.password.changedNone");
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          setErrors({ current: t("settings.password.wrongCurrent") });
          throw new Error(t("settings.password.checkCurrent"));
        }
        throw new Error(apiError(caught, "settings.password.failed"));
      }
    });
    if (ok) { setCurrent(""); setNext(""); setConfirm(""); }
  }

  const firstError = errors.current ?? errors.next ?? errors.confirm;
  const busy = action.busy === "password";

  return (
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>{t("settings.password.title")}</h2><p>{t("settings.password.lede")}</p></div>
      </div>
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label>
            {t("settings.password.current")}
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((c) => ({ ...c, current: undefined })); }} aria-invalid={Boolean(errors.current)} disabled={busy} />
          </label>
          <label>
            {t("settings.password.new")}
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setErrors((c) => ({ ...c, next: undefined })); }} aria-invalid={Boolean(errors.next)} disabled={busy} />
          </label>
          <label>
            {t("settings.password.confirm")}
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} aria-invalid={Boolean(errors.confirm)} disabled={busy} />
          </label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={busy}>{t("settings.password.submit")}</Button>
          <span className="upload-progress" style={{ marginTop: 0 }}>{t("settings.password.hint")}</span>
        </div>
        {firstError ? <p className="form-error" role="alert">{firstError}</p> : null}
      </form>
    </section>
  );
}
