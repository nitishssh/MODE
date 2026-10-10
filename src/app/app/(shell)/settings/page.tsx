"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, describeError, useAction } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { Alert, Badge, Button, Card, KeyValue, PageHead, Skeleton, StatusBadge, TextField } from "../../_components/ui";
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
      <PageHead eyebrow="You" title="Settings" description="Your account, your password, and where to find things." actions={<Button variant="danger" onClick={() => void signOut()} loading={signingOut}><Icon.logout />Sign out</Button>} />

      <div className="mx-grid mx-grid-side">
        <div className="mx-stack">
          <Card title="Account">
            <KeyValue items={[
              { label: "Name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Role", value: <StatusBadge status={user.role} /> },
              { label: "Membership", value: pass ? <StatusBadge status={pass.membership} label={pass.membership === "none" ? "Not joined" : undefined} /> : "—" },
            ]} />
            <p className="mx-eyebrow" style={{ marginTop: 16, marginBottom: 8 }}>Permissions</p>
            <div className="mx-row" style={{ gap: 6 }}>
              {user.permissions.length ? user.permissions.map((p) => <Badge key={p}><span style={{ textTransform: "none" }}>{p}</span></Badge>) : <span className="mx-muted mx-small">No officer permissions. Members can book tickets, order merchandise and submit expenses.</span>}
            </div>
          </Card>

          <Card title="Interface" tone="tight">
            <div className="mx-list">
              <Link href="/app/pass" className="mx-list-item"><span className="mx-iconbtn" style={{ pointerEvents: "none" }}><Icon.qr /></span><div className="mx-grow"><strong>Member pass</strong><small>Your QR and door code</small></div></Link>
              <Link href="/app/notifications" className="mx-list-item"><span className="mx-iconbtn" style={{ pointerEvents: "none" }}><Icon.bell /></span><div className="mx-grow"><strong>Notifications</strong><small>Announcements and reminders</small></div></Link>
              <a href="/" className="mx-list-item"><span className="mx-iconbtn" style={{ pointerEvents: "none" }}><Icon.external /></span><div className="mx-grow"><strong>Legacy workspace</strong><small>The earlier interface, with language options</small></div></a>
            </div>
          </Card>
        </div>

        <PasswordCard />
      </div>
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

  return (
    <Card title="Change password">
      <p className="mx-muted mx-small mx-mb">Changing your password keeps this session and signs out every other device.</p>
      <form className="mx-form" onSubmit={submit} noValidate>
        {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
        <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setErrors((c) => ({ ...c, current: undefined })); }} error={errors.current} />
        <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setErrors((c) => ({ ...c, next: undefined })); }} error={errors.next} hint="8 to 200 characters." />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} error={errors.confirm} />
        <div className="mx-form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "password"}><Icon.key />Change password</Button>
        </div>
      </form>
    </Card>
  );
}
