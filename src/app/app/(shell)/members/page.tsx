"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ExpiringMember, Member, Role } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { date, plural } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, FormPanel, LinkButton, PageHead, Person, PreviewNote, Skeleton, Stat, StatusBadge, TextLink } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type MembershipFilter = "all" | Member["membership"];
type RoleFilter = "all" | Role;

const ROLES: Role[] = ["member", "volunteer", "organizer", "treasurer", "admin"];

export default function MembersPage() {
  return <Suspense fallback={<Skeleton rows={6} />}><MembersView /></Suspense>;
}

function MembersView() {
  const { can } = useSession();
  const params = useSearchParams();
  const allowed = can("members:read");
  const members = useLoad(() => (allowed ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [allowed]);
  const expiring = useLoad(() => (allowed ? api.get<{ members: ExpiringMember[] }>("/api/membership/expiring?days=30") : Promise.resolve({ members: [] as ExpiringMember[] })), [allowed]);

  const [query, setQuery] = useState("");
  const [membership, setMembership] = useState<MembershipFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [adding, setAdding] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const action = useAction();

  useEffect(() => { if (params.get("add") === "1" && can("members:create")) setAdding(true); }, [params, can]);

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
        <PageHead eyebrow={<>CLUB <span>/</span> MEMBERS</>} title="Members" description="Everyone in the club, their role, and where their membership stands." />
        <section className="panel"><EmptyState title="Officer-only directory" icon="people">The member directory, with emails and dues, is visible to organizers, treasurers and admins. Your own pass is under My pass.</EmptyState></section>
      </>
    );
  }

  const active = list.filter((m) => m.membership === "active").length;

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> MEMBERS</>}
        title="Members"
        description="Everyone in the club, their role, and where their membership stands."
        actions={
          <>
            {can("membership:reminders") ? <Button onClick={() => { action.clear(); setRemindersOpen((v) => !v); }}><Icon name="alert" size={16} />Run reminders</Button> : null}
            {can("members:create") ? <Button variant="primary" onClick={() => { action.clear(); setAdding(true); }}><Icon name="plus" size={18} />Add member</Button> : null}
          </>
        }
      />

      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {members.error ? <ErrorState error={members.error} onRetry={members.reload} title="The directory could not load" /> : null}

      {adding && can("members:create") ? (
        <AddMemberPanel
          onClose={() => setAdding(false)}
          onCreated={(member) => { members.setData((c) => (c ? { members: [...c.members, member] } : c)); setAdding(false); action.setNotice(`${member.name} was added to the club.`); }}
        />
      ) : null}
      {remindersOpen && can("membership:reminders") ? (
        <RemindersPanel onClose={() => setRemindersOpen(false)} onDone={(message) => { setRemindersOpen(false); action.setNotice(message); }} />
      ) : null}

      <section className="metrics-grid" aria-label="Membership figures">
        <Stat label="Total members" value={members.data ? list.length : "—"} hint="Everyone on the club register" tone="blue" icon="people" />
        <Stat label="Active membership" value={members.data ? active : "—"} hint={members.data ? `${list.length - active} expired or not yet joined` : "Loading"} tone="green" icon="check" />
        <Stat label="Expiring in 30 days" value={expiring.data ? expiring.data.members.length : "—"} hint="Renewal reminders go to these members" tone="accent" icon="clock" />
        <Stat label="Officers" value={members.data ? list.filter((m) => m.role !== "member").length : "—"} hint="Volunteers, organizers, treasurers and leads" tone="dark" icon="coin" />
      </section>

      <div className="task-toolbar">
        <div className="task-filters">
          <label className="search-field">
            <span className="sr-only">Search members</span>
            <input type="search" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search members" />
          </label>
          <select className="filter-select" value={membership} onChange={(e) => setMembership(e.target.value as MembershipFilter)} aria-label="Filter by membership">
            <option value="all">All memberships</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="none">Not joined</option>
          </select>
          <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} aria-label="Filter by role">
            <option value="all">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <span className="mx-muted mx-small">{plural(filtered.length, "member")}</span>
      </div>

      <div className="overview-bottom" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <section className="panel members-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">THE HEART OF YOUR CLUB</div><h2>Member directory</h2></div>
            <TextLink onClick={() => void members.reload()}>Refresh</TextLink>
          </div>
          {members.loading && !members.data ? <div className="panel-body"><Skeleton rows={6} /></div> : !filtered.length ? (
            <EmptyState title={list.length ? "No matches" : "No members yet"} icon="people">{list.length ? "Try a different search or filter." : "Add the first member to get started."}</EmptyState>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Membership dues</th><th scope="col">Expires</th><th scope="col">Code</th></tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/app/members/${m.id}`}><Person name={m.name} sub={m.email} /></Link></td>
                      <td><StatusBadge status={m.role} /></td>
                      <td>{date(m.joinedAt)}</td>
                      <td>
                        <span className={`badge ${m.duesStatus === "paid" ? "green" : "amber"}`}>{m.duesStatus === "paid" ? "Paid" : "Unpaid"}</span>
                        {m.membership !== "active" ? <span className="subtext">{m.membership === "expired" ? "Membership expired" : "Not yet joined"}</span> : null}
                      </td>
                      <td>{m.expiresOn ? date(m.expiresOn) : "Not set"}</td>
                      <td><span className="payment-ref">{m.shortCode}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card kicker="RENEWALS DUE" title="Expiring within 30 days">
          {expiring.loading && !expiring.data ? <Skeleton rows={3} /> : expiring.error ? <ErrorState error={expiring.error} onRetry={expiring.reload} /> : !expiring.data?.members.length ? <p className="mx-muted mx-small">No memberships expire in the next 30 days.</p> : (
            <div className="mx-list" style={{ padding: 0 }}>
              {expiring.data.members.map((m) => (
                <div key={m.id} className="mx-list-item">
                  <div className="mx-grow">
                    <strong>{m.name}</strong>
                    <small>{m.daysLeft <= 0 ? "Expires today" : `${plural(m.daysLeft, "day")} left`} · {date(m.expiresOn)}</small>
                  </div>
                  {can("membership:record_payment") ? <LinkButton href={`/app/members/${m.id}`} size="sm" variant="green">Record dues</LinkButton> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <PreviewNote>Dues are recorded by officers against the club&apos;s fixed annual amount. Renewal reminders create in-app notices and simulated outbox rows; no email is sent.</PreviewNote>
    </>
  );
}

function AddMemberPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (member: Member) => void }) {
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => { nameInput.current?.focus(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const next: typeof errors = {};
    if (name.length < 2) next.name = "Enter the member's name (2–120 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ member: Member }>("/api/members", { name, email });
      form.reset();
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
    <FormPanel title="Add a member" description="Creates a club record without a login or payment. Record dues separately to activate membership." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            Full name
            <input ref={nameInput} name="name" placeholder="Asha Demo" autoComplete="name" minLength={2} maxLength={120} required disabled={busy} aria-invalid={Boolean(errors.name)} onChange={() => setErrors((c) => ({ ...c, name: undefined }))} />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="asha@example.com" autoComplete="email" maxLength={254} required disabled={busy} aria-invalid={Boolean(errors.email)} onChange={() => setErrors((c) => ({ ...c, email: undefined }))} />
          </label>
          <Button type="submit" variant="primary" loading={busy}>Add to directory<Icon name="arrow" size={18} /></Button>
        </div>
        {errors.name || errors.email || error ? <p className="form-error" role="alert">{errors.name ?? errors.email ?? error}</p> : null}
      </form>
    </FormPanel>
  );
}

function RemindersPanel({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
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
    <FormPanel title="Run renewal reminders" description="One in-app notification and one simulated outbox row per member whose membership expires within the window. Repeat runs skip members already reminded for the same expiry." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            Window (days)
            <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} disabled={busy} />
          </label>
          <Button type="submit" variant="primary" loading={busy}>Run reminders<Icon name="arrow" size={18} /></Button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </FormPanel>
  );
}
