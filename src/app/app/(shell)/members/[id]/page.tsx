"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { DuesPayment, Member, Role } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { date, dateTime } from "../../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, KeyValue, Money, PageHead, SelectField, Skeleton, StatusBadge, Table, TextField } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";

const ROLES: Role[] = ["member", "volunteer", "organizer", "treasurer", "admin"];

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, can } = useSession();
  const allowed = can("members:read");

  const members = useLoad(() => (allowed ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [allowed]);
  const dues = useLoad(() => (allowed ? api.get<{ payments: DuesPayment[] }>(`/api/members/${encodeURIComponent(id)}/dues`) : Promise.resolve({ payments: [] as DuesPayment[] })), [allowed, id]);

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow="Club" title="Member" />
        <EmptyState title="Officer-only page">Member records are visible to organizers, treasurers and admins.</EmptyState>
      </>
    );
  }

  const member = members.data?.members.find((m) => m.id === id) ?? null;

  if (members.loading && !members.data) return <><PageHead eyebrow="Club" title="Member" /><Skeleton rows={6} /></>;
  if (members.error) return <><PageHead eyebrow="Club" title="Member" /><ErrorState error={members.error} onRetry={members.reload} /></>;
  if (!member) {
    return (
      <>
        <PageHead eyebrow="Club" title="Member not found" />
        <EmptyState title="No such member in this club" action={<Link href="/app/members" className="mx-btn">Back to members</Link>}>The link may be stale, or the member belongs to another club.</EmptyState>
      </>
    );
  }

  const isSelf = user?.id === member.id;

  function patchMember(next: Partial<Member>) {
    members.setData((c) => (c ? { members: c.members.map((m) => (m.id === member!.id ? { ...m, ...next } : m)) } : c));
  }

  return (
    <>
      <Link href="/app/members" className="mx-link mx-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}><Icon.back />All members</Link>
      <PageHead
        eyebrow="Member"
        title={member.name}
        description={member.email}
        actions={<><StatusBadge status={member.role} /><StatusBadge status={member.membership} label={member.membership === "none" ? "Not joined" : undefined} /></>}
      />

      <div className="mx-grid mx-grid-side">
        <div className="mx-stack">
          <Card title="Profile">
            <KeyValue items={[
              { label: "Email", value: member.email },
              { label: "Role", value: <StatusBadge status={member.role} /> },
              { label: "Membership", value: <StatusBadge status={member.membership} label={member.membership === "none" ? "Not joined" : undefined} /> },
              { label: "Expires on", value: date(member.expiresOn) },
              { label: "Joined", value: date(member.joinedAt) },
              { label: "Dues", value: <StatusBadge status={member.duesStatus} /> },
              { label: "Door code", value: <code className="mx-mono">{member.shortCode}</code> },
            ]} />
          </Card>

          {can("roles:manage") ? <RoleCard member={member} isSelf={isSelf} onChanged={patchMember} /> : null}
          {can("roles:manage") ? <PasswordCard member={member} /> : null}
        </div>

        <div className="mx-stack">
          {can("membership:record_payment") ? (
            <DuesCard
              member={member}
              onRecorded={(result) => {
                patchMember({ membership: result.membership, expiresOn: result.expiresOn, duesStatus: "paid" });
                void dues.reload();
              }}
            />
          ) : null}

          <Card title="Dues history">
            {dues.loading && !dues.data ? <Skeleton rows={3} /> : dues.error ? <ErrorState error={dues.error} onRetry={dues.reload} /> : !dues.data?.payments.length ? <p className="mx-muted">No dues recorded for this member yet.</p> : (
              <Table head={<><th>Recorded</th><th>Reference</th><th className="num">Amount</th><th>Expiry</th></>}>
                {[...dues.data.payments].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map((p) => (
                  <tr key={p.id}>
                    <td>{dateTime(p.recordedAt)}</td>
                    <td><code className="mx-mono">{p.reference}</code></td>
                    <td className="num"><Money paise={p.amountPaise} exact /></td>
                    <td>{p.previousExpiresOn ? `${date(p.previousExpiresOn)} → ` : "New · "}{date(p.newExpiresOn)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function DuesCard({ member, onRecorded }: { member: Member; onRecorded: (result: { membership: Member["membership"]; expiresOn: string }) => void }) {
  const [reference, setReference] = useState("");
  const [fieldError, setFieldError] = useState("");
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ref = reference.trim();
    if (ref.length < 3) { setFieldError("Enter the payment reference (at least 3 characters)."); return; }
    setFieldError("");
    const ok = await action.run("dues", async () => {
      const result = await api.post<{ payment: DuesPayment; created: boolean; membership: Member["membership"]; expiresOn: string }>("/api/membership/dues", { memberId: member.id, reference: ref });
      onRecorded(result);
      return result.created
        ? `Dues recorded. ${member.name}'s membership now runs through ${date(result.expiresOn)}.`
        : `Reference "${ref}" was already recorded for ${member.name}; nothing was credited again. Membership runs through ${date(result.expiresOn)}.`;
    });
    if (ok) setReference("");
  }

  return (
    <Card title="Record dues payment">
      <p className="mx-muted mx-small mx-mb">The amount is the club's fixed annual dues. A first payment activates membership for 365 days; a renewal adds 365 days to the later of today and the current expiry, so paying early never loses days.</p>
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      <form className="mx-form" onSubmit={submit} noValidate>
        <TextField label="Payment reference" placeholder="UPI / bank / cash receipt reference" value={reference} onChange={(e) => { setReference(e.target.value); setFieldError(""); }} error={fieldError} hint="Replaying the same reference is safe: it returns the original payment." />
        <div className="mx-form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "dues"}><Icon.check />Record payment</Button>
        </div>
      </form>
    </Card>
  );
}

function RoleCard({ member, isSelf, onChanged }: { member: Member; isSelf: boolean; onChanged: (next: Partial<Member>) => void }) {
  const [role, setRole] = useState<Role>(member.role);
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === member.role) { action.setError("Pick a different role first."); return; }
    await action.run("role", async () => {
      try {
        const result = await api.patch<{ member: Member }>(`/api/members/${encodeURIComponent(member.id)}/role`, { role });
        onChanged({ role: result.member.role });
        return `${member.name} is now ${result.member.role}.`;
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) throw new Error("You cannot change your own role.");
        throw new Error(describeError(caught, "We could not change the role."));
      }
    });
  }

  return (
    <Card title="Role">
      {isSelf ? <p className="mx-muted mx-small">You cannot change your own role. Ask another admin.</p> : (
        <form className="mx-form" onSubmit={submit} noValidate>
          {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <SelectField label="Club role" value={role} onChange={(e) => setRole(e.target.value as Role)} hint="Role changes are written to the audit trail.">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>
          <div className="mx-form-actions">
            <Button type="submit" variant="primary" loading={action.busy === "role"} disabled={role === member.role}>Change role</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function PasswordCard({ member }: { member: Member }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8 || password.length > 200) next.password = "Use 8 to 200 characters.";
    if (confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await action.run("password", async () => {
      await api.post<{ ok: true }>(`/api/members/${encodeURIComponent(member.id)}/password`, { password });
      return `Password set for ${member.name}. Share it privately; they can change it from Settings.`;
    });
    if (ok) { setPassword(""); setConfirm(""); }
  }

  return (
    <Card title="Set password">
      <p className="mx-muted mx-small mx-mb">Gives this member a login, or resets a forgotten one. This is audited.</p>
      <form className="mx-form" onSubmit={submit} noValidate>
        {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
        <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, password: undefined })); }} error={errors.password} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} error={errors.confirm} />
        <div className="mx-form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "password"}><Icon.key />Set password</Button>
        </div>
      </form>
    </Card>
  );
}
