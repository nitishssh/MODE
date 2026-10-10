"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { DuesPayment, Member, Role } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { amount, date, dateTime } from "../../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, KeyValue, LinkButton, PageHead, PreviewNote, Skeleton, StatusBadge } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";

const ROLES: Role[] = ["member", "volunteer", "organizer", "treasurer", "admin"];
const EYEBROW = <>CLUB <span>/</span> MEMBERS</>;

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
        <PageHead eyebrow={EYEBROW} title="Member" />
        <section className="panel"><EmptyState title="Officer-only page" icon="people">Member records are visible to organizers, treasurers and admins.</EmptyState></section>
      </>
    );
  }

  const member = members.data?.members.find((m) => m.id === id) ?? null;

  if (members.loading && !members.data) return <><PageHead eyebrow={EYEBROW} title="Member" /><Skeleton rows={6} /></>;
  if (members.error) return <><PageHead eyebrow={EYEBROW} title="Member" /><ErrorState error={members.error} onRetry={members.reload} /></>;
  if (!member) {
    return (
      <>
        <PageHead eyebrow={EYEBROW} title="Member not found" />
        <section className="panel"><EmptyState title="No such member in this club" icon="people" action={<LinkButton href="/app/members" variant="primary">Back to members</LinkButton>}>The link may be stale, or the member belongs to another club.</EmptyState></section>
      </>
    );
  }

  const isSelf = user?.id === member.id;

  function patchMember(next: Partial<Member>) {
    members.setData((c) => (c ? { members: c.members.map((m) => (m.id === member!.id ? { ...m, ...next } : m)) } : c));
  }

  return (
    <>
      <Link href="/app/members" className="text-button" style={{ marginBottom: 12 }}><Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} />All members</Link>
      <PageHead
        eyebrow={EYEBROW}
        title={member.name}
        description={member.email}
        actions={<><StatusBadge status={member.role} /><StatusBadge status={member.membership} label={member.membership === "none" ? "Not joined" : undefined} /></>}
      />

      <div className="treasury-overview-grid">
        <div className="mx-stack">
          <Card kicker="MEMBER RECORD" title="Profile">
            <KeyValue items={[
              { label: "Email", value: member.email },
              { label: "Role", value: <StatusBadge status={member.role} /> },
              { label: "Membership", value: <StatusBadge status={member.membership} label={member.membership === "none" ? "Not joined" : undefined} /> },
              { label: "Expires on", value: member.expiresOn ? date(member.expiresOn) : "Not set" },
              { label: "Joined", value: date(member.joinedAt) },
              { label: "Dues", value: <span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>{member.duesStatus === "paid" ? "Paid" : "Unpaid"}</span> },
              { label: "Door code", value: <span className="payment-ref">{member.shortCode}</span> },
            ]} />
          </Card>

          {can("membership:record_payment") ? (
            <DuesCard
              member={member}
              onRecorded={(result) => {
                patchMember({ membership: result.membership, expiresOn: result.expiresOn, duesStatus: "paid" });
                void dues.reload();
              }}
            />
          ) : null}

          <section className="panel">
            <div className="panel-heading">
              <div><div className="eyebrow">PAYMENT REGISTER</div><h2>Dues history</h2></div>
            </div>
            {dues.loading && !dues.data ? <div className="panel-body"><Skeleton rows={3} /></div> : dues.error ? <div className="panel-body"><ErrorState error={dues.error} onRetry={dues.reload} /></div> : !dues.data?.payments.length ? (
              <EmptyState title="No dues recorded yet" icon="coin">A first payment activates membership for 365 days.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">Recorded</th><th scope="col">Reference</th><th scope="col" className="amount-cell">Amount</th><th scope="col">Expiry</th></tr></thead>
                  <tbody>
                    {[...dues.data.payments].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map((p) => (
                      <tr key={p.id}>
                        <td>{dateTime(p.recordedAt)}</td>
                        <td><span className="payment-ref">{p.reference}</span></td>
                        <td className="amount-cell positive">+{amount(p.amountPaise)}</td>
                        <td><strong>{date(p.newExpiresOn)}</strong>{p.previousExpiresOn ? <span className="subtext">was {date(p.previousExpiresOn)}</span> : <span className="subtext">First payment</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="mx-stack">
          {can("roles:manage") ? <RoleCard member={member} isSelf={isSelf} onChanged={patchMember} /> : null}
          {can("roles:manage") ? <PasswordCard member={member} /> : null}
          {!can("roles:manage") ? <Card kicker="ACCESS" title="Role changes">
            <p className="mx-muted mx-small">Only the club lead can change roles or set passwords.</p>
          </Card> : null}
        </div>
      </div>

      <PreviewNote>Role changes and password resets are written to the audit trail. Dues replay the same reference safely and never credit twice.</PreviewNote>
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
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div>
          <h2>Record dues payment</h2>
          <p>The amount is the club&apos;s fixed annual dues. A first payment activates membership for 365 days; a renewal adds 365 days to the later of today and the current expiry, so paying early never loses days.</p>
        </div>
      </div>
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            Payment reference
            <input placeholder="UPI / bank / cash receipt reference" value={reference} onChange={(e) => { setReference(e.target.value); setFieldError(""); }} aria-invalid={Boolean(fieldError)} disabled={action.busy === "dues"} />
          </label>
          <Button type="submit" variant="primary" loading={action.busy === "dues"}>Record payment<Icon name="arrow" size={18} /></Button>
        </div>
        {fieldError ? <p className="form-error" role="alert">{fieldError}</p> : <p className="upload-progress">Replaying the same reference is safe: it returns the original payment.</p>}
      </form>
    </section>
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
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>Role</h2><p>Role changes are written to the audit trail.</p></div>
      </div>
      {isSelf ? <p className="mx-muted mx-small">You cannot change your own role. Ask another admin.</p> : (
        <form onSubmit={submit} noValidate>
          {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <div className="task-form-grid">
            <label>
              Club role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={action.busy === "role"}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={action.busy === "role"} disabled={role === member.role}>Change role</Button>
          </div>
        </form>
      )}
    </section>
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
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>Set password</h2><p>Gives this member a login, or resets a forgotten one. This is audited.</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
        <div className="task-form-grid">
          <label>
            New password
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, password: undefined })); }} aria-invalid={Boolean(errors.password)} disabled={action.busy === "password"} />
          </label>
          <label>
            Confirm password
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} aria-invalid={Boolean(errors.confirm)} disabled={action.busy === "password"} />
          </label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "password"}>Set password</Button>
        </div>
        {errors.password || errors.confirm ? <p className="form-error" role="alert">{errors.password ?? errors.confirm}</p> : null}
      </form>
    </section>
  );
}
