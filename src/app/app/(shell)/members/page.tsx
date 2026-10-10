"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ExpiringMember, Member, Role } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { date, plural } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, Input, LinkButton, Modal, PageHead, Select, Skeleton, Stat, StatusBadge, Table, TextField } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type MembershipFilter = "all" | Member["membership"];
type RoleFilter = "all" | Role;

const ROLES: Role[] = ["member", "volunteer", "organizer", "treasurer", "admin"];

export default function MembersPage() {
  const { can } = useSession();
  const allowed = can("members:read");
  const members = useLoad(() => (allowed ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [allowed]);
  const expiring = useLoad(() => (allowed ? api.get<{ members: ExpiringMember[] }>("/api/membership/expiring?days=30") : Promise.resolve({ members: [] as ExpiringMember[] })), [allowed]);

  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState<MembershipFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [adding, setAdding] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const action = useAction();

  const list = members.data?.members ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((m) =>
      (membership === "all" || m.membership === membership) &&
      (role === "all" || m.role === role) &&
      (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  }, [list, query, membership, role]);

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow="Club" title="Members" />
        <EmptyState title="Officer-only directory">The member directory, with emails and dues, is visible to organizers, treasurers and admins. Your own pass is under Member pass.</EmptyState>
      </>
    );
  }

  const active = list.filter((m) => m.membership === "active").length;

  return (
    <>
      <PageHead
        eyebrow="Club"
        title="Members"
        description="Everyone in the club, their role, and where their membership stands."
        actions={
          <>
            {can("membership:reminders") ? <Button onClick={() => { action.clear(); setRemindersOpen(true); }}><Icon.mail />Run reminders</Button> : null}
            {can("members:create") ? <Button variant="primary" onClick={() => setAdding(true)}><Icon.plus />Add member</Button> : null}
          </>
        }
      />

      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {members.error ? <div className="mx-mb"><ErrorState error={members.error} onRetry={members.reload} /></div> : null}

      <div className="mx-grid mx-grid-3 mx-mb">
        <Stat label="Total members" value={members.data ? list.length : "—"} tone="blue" />
        <Stat label="Active membership" value={members.data ? active : "—"} hint={members.data ? `${list.length - active} expired or not yet joined` : undefined} tone="green" />
        <Stat label="Expiring in 30 days" value={expiring.data ? expiring.data.members.length : "—"} hint="Renewal reminders go to these members" tone="amber" />
      </div>

      <div className="mx-grid mx-grid-main">
        <div className="mx-stack">
          <div className="mx-toolbar">
            <Input placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
            <Select value={membership} onChange={(e) => setMembership(e.target.value as MembershipFilter)} aria-label="Filter by membership">
              <option value="all">All memberships</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="none">Not joined</option>
            </Select>
            <Select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} aria-label="Filter by role">
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <span className="mx-muted mx-small mx-right">{plural(filtered.length, "member")}</span>
          </div>

          {members.loading && !members.data ? <Skeleton rows={6} /> : (
            <Table
              head={<><th>Member</th><th>Role</th><th>Membership</th><th>Expires</th><th>Dues</th><th>Code</th></>}
              empty={!filtered.length ? <EmptyState title={list.length ? "No matches" : "No members yet"}>{list.length ? "Try a different search or filter." : "Add the first member to get started."}</EmptyState> : null}
            >
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/app/members/${m.id}`} className="mx-cell-title">{m.name}</Link><span className="mx-cell-sub">{m.email}</span></td>
                  <td><StatusBadge status={m.role} /></td>
                  <td><StatusBadge status={m.membership} label={m.membership === "none" ? "Not joined" : undefined} /></td>
                  <td>{date(m.expiresOn)}</td>
                  <td><StatusBadge status={m.duesStatus} /></td>
                  <td><code className="mx-mono">{m.shortCode}</code></td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <Card title="Expiring within 30 days">
          {expiring.loading && !expiring.data ? <Skeleton rows={3} /> : expiring.error ? <ErrorState error={expiring.error} onRetry={expiring.reload} /> : !expiring.data?.members.length ? <p className="mx-muted">No memberships expire in the next 30 days.</p> : (
            <div className="mx-list">
              {expiring.data.members.map((m) => (
                <div key={m.id} className="mx-list-item">
                  <div className="mx-grow">
                    <strong>{m.name}</strong>
                    <small>{m.daysLeft <= 0 ? "Expires today" : `${plural(m.daysLeft, "day")} left`} · {date(m.expiresOn)}</small>
                  </div>
                  {can("membership:record_payment") ? <LinkButton href={`/app/members/${m.id}`} size="sm">Record dues</LinkButton> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <AddMemberModal open={adding} onClose={() => setAdding(false)} onCreated={(member) => { members.setData((c) => (c ? { members: [...c.members, member] } : c)); setAdding(false); action.setNotice(`${member.name} was added to the club.`); }} />

      <RemindersModal open={remindersOpen} onClose={() => setRemindersOpen(false)} onDone={(message) => { setRemindersOpen(false); action.setNotice(message); }} />
    </>
  );
}

function AddMemberModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (member: Member) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Enter the member's name (2–120 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ member: Member }>("/api/members", { name: name.trim(), email: email.trim() });
      setName(""); setEmail("");
      onCreated(result.member);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setErrors({ email: "A member with this email already exists." });
      else if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field, d.message])));
      else setError(describeError(caught, "We could not add the member."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Add a member" description="Creates a club record without a login or payment. Record dues separately to activate membership." onClose={onClose}>
      <form className="mx-form" onSubmit={submit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField label="Full name" value={name} onChange={(e) => { setName(e.target.value); setErrors((c) => ({ ...c, name: undefined })); }} error={errors.name} autoFocus />
        <TextField label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((c) => ({ ...c, email: undefined })); }} error={errors.email} />
        <div className="mx-form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Add member</Button>
        </div>
      </form>
    </Modal>
  );
}

function RemindersModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) { setError("Enter a whole number of days between 1 and 365."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ asOf: string; windowDays: number; candidates: number; sent: number; skipped: number }>("/api/membership/reminders/run", { days: n });
      onDone(`Reminders run for the next ${result.windowDays} days: ${result.candidates} candidates, ${result.sent} sent, ${result.skipped} already reminded. Delivery is simulated; no email leaves the system.`);
    } catch (caught) {
      setError(describeError(caught, "We could not run reminders."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Run renewal reminders" description="Creates one in-app notification and one simulated outbox row per member whose membership expires within the window. Repeat runs skip members already reminded for the same expiry." onClose={onClose}>
      <form className="mx-form" onSubmit={submit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField label="Window (days)" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        <div className="mx-form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}><Icon.mail />Run reminders</Button>
        </div>
      </form>
    </Modal>
  );
}
