"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, describeError, useAction } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { Alert, Button, Card, KeyValue, PageHead, PreviewNote, Skeleton, StatusBadge } from "../../_components/ui";
import { Icon } from "../../_components/icons";

export default function SettingsPage() {
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
        eyebrow={<>YOU <span>/</span> SETTINGS</>}
        title="Settings"
        description="Your account, your password, and where to find things."
        actions={<Button variant="danger" onClick={() => void signOut()} loading={signingOut}><Icon name="logout" size={16} />Sign out</Button>}
      />

      <div className="treasury-overview-grid">
        <div className="mx-stack">
          <Card kicker="WHO YOU ARE" title="Account">
            <KeyValue items={[
              { label: "Name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Role", value: <StatusBadge status={user.role} /> },
              { label: "Membership", value: pass ? <StatusBadge status={pass.membership} label={pass.membership === "none" ? "Not joined" : undefined} /> : "—" },
            ]} />
            <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>PERMISSIONS</div>
            <div className="mx-row" style={{ gap: 6 }}>
              {user.permissions.length ? user.permissions.map((p) => <span key={p} className="badge neutral">{p}</span>) : <span className="mx-muted mx-small">No officer permissions. Members can book tickets, order merchandise and submit expenses.</span>}
            </div>
          </Card>

          <section className="panel">
            <div className="panel-heading">
              <div><div className="eyebrow">AROUND THE WORKSPACE</div><h2>Interface</h2></div>
            </div>
            <div className="event-list">
              <Link href="/app/pass" className="event-row">
                <span className="announcement-symbol"><Icon name="coin" size={20} /></span>
                <div className="event-info"><h3>My pass</h3><p>Your QR and door code</p></div>
                <Icon name="chevron" size={14} />
              </Link>
              <Link href="/app/notifications" className="event-row">
                <span className="announcement-symbol"><Icon name="megaphone" size={20} /></span>
                <div className="event-info"><h3>Notifications</h3><p>Announcements and reminders</p></div>
                <Icon name="chevron" size={14} />
              </Link>
              <a href="/" className="event-row">
                <span className="announcement-symbol"><Icon name="grid" size={20} /></span>
                <div className="event-info"><h3>Legacy workspace</h3><p>The earlier interface at the site root</p></div>
                <Icon name="chevron" size={14} />
              </a>
            </div>
          </section>
        </div>

        <PasswordCard />
      </div>

      <PreviewNote>Changing your password keeps this session and signs out every other device.</PreviewNote>
    </>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const e: typeof errors = {};
    if (!current) e.current = "Enter your current password.";
    if (next.length < 8 || next.length > 200) e.next = "Use 8 to 200 characters.";
    if (next && next === current) e.next = "Choose a password you have not used just now.";
    if (confirm !== next) e.confirm = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const ok = await action.run("password", async () => {
      try {
        const result = await api.post<{ ok: true; revokedSessions: number }>("/api/auth/password", { currentPassword: current, newPassword: next });
        return result.revokedSessions > 0
          ? `Password changed. ${result.revokedSessions} other session${result.revokedSessions === 1 ? " was" : "s were"} signed out; this one stays signed in.`
          : "Password changed. No other sessions were open.";
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          setErrors({ current: "That is not your current password." });
          throw new Error("Check your current password and try again.");
        }
        throw new Error(describeError(caught, "We could not change your password."));
      }
    });
    if (ok) { setCurrent(""); setNext(""); setConfirm(""); }
  }

  const firstError = errors.current ?? errors.next ?? errors.confirm;

  return (
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>Change password</h2><p>Keeps this session and signs out every other device.</p></div>
      </div>
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label>
            Current password
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((c) => ({ ...c, current: undefined })); }} aria-invalid={Boolean(errors.current)} disabled={action.busy === "password"} />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setErrors((c) => ({ ...c, next: undefined })); }} aria-invalid={Boolean(errors.next)} disabled={action.busy === "password"} />
          </label>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} aria-invalid={Boolean(errors.confirm)} disabled={action.busy === "password"} />
          </label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "password"}>Change password</Button>
          <span className="upload-progress" style={{ marginTop: 0 }}>8 to 200 characters.</span>
        </div>
        {firstError ? <p className="form-error" role="alert">{firstError}</p> : null}
      </form>
    </section>
  );
}
