"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ExpiringMember, Member, Role } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";
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
  const { t, fmt } = useT();
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

  // Open the add form when the URL asks for it (?add=1), adjusted during render rather than in an effect.
  const addRequested = params.get("add") === "1" && can("members:create");
  const [seenAddRequest, setSeenAddRequest] = useState(false);
  if (addRequested !== seenAddRequest) {
    setSeenAddRequest(addRequested);
    if (addRequested) setAdding(true);
  }

  const list = useMemo(() => members.data?.members ?? [], [members.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((m) =>
      (membership === "all" || m.membership === membership) &&
      (role === "all" || m.role === role) &&
      (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)),
    );
  }, [list, query, membership, role]);

  const eyebrow = <>{t("members.eyebrow.club")} <span>/</span> {t("members.eyebrow.section")}</>;

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("members.title")} description={t("members.description")} />
        <section className="panel"><EmptyState title={t("members.officerOnly.title")} icon="people">{t("members.officerOnly.body")}</EmptyState></section>
      </>
    );
  }

  const active = list.filter((m) => m.membership === "active").length;
  const countKey = filtered.length === 1 ? "members.count.one" : "members.count.many";

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={t("members.title")}
        description={t("members.description")}
        actions={
          <>
            {can("membership:reminders") ? <Button onClick={() => { action.clear(); setRemindersOpen((v) => !v); }}><Icon name="alert" size={16} />{t("members.runReminders")}</Button> : null}
            {can("members:create") ? <Button variant="primary" onClick={() => { action.clear(); setAdding(true); }}><Icon name="plus" size={18} />{t("members.addMember")}</Button> : null}
          </>
        }
      />

      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {members.error ? <ErrorState error={members.error} onRetry={members.reload} title={t("members.loadError")} /> : null}

      {adding && can("members:create") ? (
        <AddMemberPanel
          onClose={() => setAdding(false)}
          onCreated={(member) => { members.setData((c) => (c ? { members: [...c.members, member] } : c)); setAdding(false); action.setNotice(t("members.added", { name: member.name })); }}
        />
      ) : null}
      {remindersOpen && can("membership:reminders") ? (
        <RemindersPanel onClose={() => setRemindersOpen(false)} onDone={(message) => { setRemindersOpen(false); action.setNotice(message); }} />
      ) : null}

      <section className="metrics-grid" aria-label={t("members.metrics.label")}>
        <Stat label={t("members.metrics.total")} value={members.data ? list.length : "—"} hint={t("members.metrics.totalHint")} tone="blue" icon="people" />
        <Stat label={t("members.metrics.active")} value={members.data ? active : "—"} hint={members.data ? t("members.metrics.activeHint", { count: list.length - active }) : t("members.metrics.loading")} tone="green" icon="check" />
        <Stat label={t("members.metrics.expiring")} value={expiring.data ? expiring.data.members.length : "—"} hint={t("members.metrics.expiringHint")} tone="accent" icon="clock" />
        <Stat label={t("members.metrics.officers")} value={members.data ? list.filter((m) => m.role !== "member").length : "—"} hint={t("members.metrics.officersHint")} tone="dark" icon="coin" />
      </section>

      <div className="task-toolbar">
        <div className="task-filters">
          <label className="search-field">
            <span className="sr-only">{t("members.search")}</span>
            <input type="search" placeholder={t("members.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("members.search")} />
          </label>
          <select className="filter-select" value={membership} onChange={(e) => setMembership(e.target.value as MembershipFilter)} aria-label={t("members.filterMembership")}>
            <option value="all">{t("members.allMemberships")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="expired">{t("status.expired")}</option>
            <option value="none">{t("status.none")}</option>
          </select>
          <select className="filter-select" value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} aria-label={t("members.filterRole")}>
            <option value="all">{t("members.allRoles")}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
          </select>
        </div>
        <span className="mx-muted mx-small">{t(countKey, { count: filtered.length })}</span>
      </div>

      <div className="overview-bottom" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <section className="panel members-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">{t("members.directory.kicker")}</div><h2>{t("members.directory.title")}</h2></div>
            <TextLink onClick={() => void members.reload()}>{t("action.refresh")}</TextLink>
          </div>
          {members.loading && !members.data ? <div className="panel-body"><Skeleton rows={6} /></div> : !filtered.length ? (
            <EmptyState title={list.length ? t("members.directory.noMatches") : t("members.directory.empty")} icon="people">{list.length ? t("members.directory.noMatchesBody") : t("members.directory.emptyBody")}</EmptyState>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th scope="col">{t("col.member")}</th><th scope="col">{t("col.role")}</th><th scope="col">{t("col.joined")}</th><th scope="col">{t("members.col.dues")}</th><th scope="col">{t("col.expires")}</th><th scope="col">{t("col.code")}</th></tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/app/members/${m.id}`}><Person name={m.name} sub={m.email} /></Link></td>
                      <td><StatusBadge status={m.role} label={t(`role.${m.role}`)} /></td>
                      <td>{fmt.date(m.joinedAt)}</td>
                      <td>
                        <span className={`badge ${m.duesStatus === "paid" ? "green" : "amber"}`}>{m.duesStatus === "paid" ? t("status.paid") : t("status.unpaid")}</span>
                        {m.membership !== "active" ? <span className="subtext">{m.membership === "expired" ? t("members.membershipExpired") : t("members.notYetJoined")}</span> : null}
                      </td>
                      <td>{m.expiresOn ? fmt.date(m.expiresOn) : t("state.notSet")}</td>
                      <td><span className="payment-ref">{m.shortCode}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card kicker={t("members.expiring.kicker")} title={t("members.expiring.title")}>
          {expiring.loading && !expiring.data ? <Skeleton rows={3} /> : expiring.error ? <ErrorState error={expiring.error} onRetry={expiring.reload} /> : !expiring.data?.members.length ? <p className="mx-muted mx-small">{t("members.expiring.none")}</p> : (
            <div className="mx-list" style={{ padding: 0 }}>
              {expiring.data.members.map((m) => (
                <div key={m.id} className="mx-list-item">
                  <div className="mx-grow">
                    <strong>{m.name}</strong>
                    <small>{m.daysLeft <= 0 ? t("members.expiring.today") : t(m.daysLeft === 1 ? "members.expiring.daysLeft.one" : "members.expiring.daysLeft.many", { count: m.daysLeft })} · {fmt.date(m.expiresOn)}</small>
                  </div>
                  {can("membership:record_payment") ? <LinkButton href={`/app/members/${m.id}`} size="sm" variant="green">{t("members.expiring.recordDues")}</LinkButton> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <PreviewNote>{t("members.previewNote")}</PreviewNote>
    </>
  );
}

function AddMemberPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (member: Member) => void }) {
  const { t, apiError } = useT();
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
    if (name.length < 2) next.name = t("members.add.nameError");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("members.add.emailError");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ member: Member }>("/api/members", { name, email });
      form.reset();
      onCreated(result.member);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setErrors({ email: t("members.add.duplicate") });
      else if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field, d.message])));
      else setError(apiError(caught) || t("members.add.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormPanel title={t("members.add.title")} description={t("members.add.description")} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            {t("members.add.fullName")}
            <input ref={nameInput} name="name" placeholder={t("members.add.namePlaceholder")} autoComplete="name" minLength={2} maxLength={120} required disabled={busy} aria-invalid={Boolean(errors.name)} onChange={() => setErrors((c) => ({ ...c, name: undefined }))} />
          </label>
          <label>
            {t("col.email")}
            <input name="email" type="email" placeholder={t("members.add.emailPlaceholder")} autoComplete="email" maxLength={254} required disabled={busy} aria-invalid={Boolean(errors.email)} onChange={() => setErrors((c) => ({ ...c, email: undefined }))} />
          </label>
          <Button type="submit" variant="primary" loading={busy}>{t("members.add.submit")}<Icon name="arrow" size={18} /></Button>
        </div>
        {errors.name || errors.email || error ? <p className="form-error" role="alert">{errors.name ?? errors.email ?? error}</p> : null}
      </form>
    </FormPanel>
  );
}

function RemindersPanel({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { t, apiError } = useT();
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) { setError(t("members.reminders.windowError")); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ asOf: string; windowDays: number; candidates: number; sent: number; skipped: number }>("/api/membership/reminders/run", { days: n });
      onDone(t("members.reminders.result", { days: result.windowDays, candidates: result.candidates, sent: result.sent, skipped: result.skipped }));
    } catch (caught) {
      setError(apiError(caught) || t("members.reminders.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormPanel title={t("members.reminders.title")} description={t("members.reminders.description")} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            {t("members.reminders.window")}
            <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} disabled={busy} />
          </label>
          <Button type="submit" variant="primary" loading={busy}>{t("members.runReminders")}<Icon name="arrow" size={18} /></Button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </FormPanel>
  );
}
