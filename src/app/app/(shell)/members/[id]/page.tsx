"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { DuesPayment, Member, Role } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { useT } from "../../../_lib/i18n";
import { Alert, Button, Card, EmptyState, ErrorState, KeyValue, LinkButton, PageHead, PreviewNote, Skeleton, StatusBadge } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";

const ROLES: Role[] = ["member", "volunteer", "organizer", "treasurer", "admin"];

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, can } = useSession();
  const { t, fmt } = useT();
  const allowed = can("members:read");

  const members = useLoad(() => (allowed ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [allowed]);
  const dues = useLoad(() => (allowed ? api.get<{ payments: DuesPayment[] }>(`/api/members/${encodeURIComponent(id)}/dues`) : Promise.resolve({ payments: [] as DuesPayment[] })), [allowed, id]);

  const eyebrow = <>{t("members.eyebrow.club")} <span>/</span> {t("members.eyebrow.section")}</>;

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("members.detail.title")} />
        <section className="panel"><EmptyState title={t("members.detail.officerOnly.title")} icon="people">{t("members.detail.officerOnly.body")}</EmptyState></section>
      </>
    );
  }

  const member = members.data?.members.find((m) => m.id === id) ?? null;

  if (members.loading && !members.data) return <><PageHead eyebrow={eyebrow} title={t("members.detail.title")} /><Skeleton rows={6} /></>;
  if (members.error) return <><PageHead eyebrow={eyebrow} title={t("members.detail.title")} /><ErrorState error={members.error} onRetry={members.reload} /></>;
  if (!member) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("members.detail.notFound")} />
        <section className="panel"><EmptyState title={t("members.detail.notFoundTitle")} icon="people" action={<LinkButton href="/app/members" variant="primary">{t("members.detail.backToMembers")}</LinkButton>}>{t("members.detail.notFoundBody")}</EmptyState></section>
      </>
    );
  }

  const isSelf = user?.id === member.id;
  const membershipLabel = member.membership === "none" ? t("status.none") : t(`status.${member.membership}`);

  function patchMember(next: Partial<Member>) {
    members.setData((c) => (c ? { members: c.members.map((m) => (m.id === member!.id ? { ...m, ...next } : m)) } : c));
  }

  return (
    <>
      <Link href="/app/members" className="text-button" style={{ marginBottom: 12 }}><Icon name="chevron" size={14} style={{ transform: "rotate(180deg)" }} />{t("members.detail.allMembers")}</Link>
      <PageHead
        eyebrow={eyebrow}
        title={member.name}
        description={member.email}
        actions={<><StatusBadge status={member.role} label={t(`role.${member.role}`)} /><StatusBadge status={member.membership} label={membershipLabel} /></>}
      />

      <div className="treasury-overview-grid">
        <div className="mx-stack">
          <Card kicker={t("members.detail.profile.kicker")} title={t("members.detail.profile.title")}>
            <KeyValue items={[
              { label: t("col.email"), value: member.email },
              { label: t("col.role"), value: <StatusBadge status={member.role} label={t(`role.${member.role}`)} /> },
              { label: t("membership.label"), value: <StatusBadge status={member.membership} label={membershipLabel} /> },
              { label: t("members.detail.expiresOn"), value: member.expiresOn ? fmt.date(member.expiresOn) : t("state.notSet") },
              { label: t("col.joined"), value: fmt.date(member.joinedAt) },
              { label: t("members.detail.dues"), value: <span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>{member.duesStatus === "paid" ? t("status.paid") : t("status.unpaid")}</span> },
              { label: t("members.detail.doorCode"), value: <span className="payment-ref">{member.shortCode}</span> },
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
              <div><div className="eyebrow">{t("members.history.kicker")}</div><h2>{t("members.history.title")}</h2></div>
            </div>
            {dues.loading && !dues.data ? <div className="panel-body"><Skeleton rows={3} /></div> : dues.error ? <div className="panel-body"><ErrorState error={dues.error} onRetry={dues.reload} /></div> : !dues.data?.payments.length ? (
              <EmptyState title={t("members.history.empty")} icon="coin">{t("members.history.emptyBody")}</EmptyState>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">{t("members.history.recorded")}</th><th scope="col">{t("col.reference")}</th><th scope="col" className="amount-cell">{t("col.amount")}</th><th scope="col">{t("members.history.expiry")}</th></tr></thead>
                  <tbody>
                    {[...dues.data.payments].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map((p) => (
                      <tr key={p.id}>
                        <td>{fmt.dateTime(p.recordedAt)}</td>
                        <td><span className="payment-ref">{p.reference}</span></td>
                        <td className="amount-cell positive">+{fmt.currency(p.amountPaise)}</td>
                        <td><strong>{fmt.date(p.newExpiresOn)}</strong>{p.previousExpiresOn ? <span className="subtext">{t("members.history.was", { date: fmt.date(p.previousExpiresOn) })}</span> : <span className="subtext">{t("members.history.first")}</span>}</td>
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
          {!can("roles:manage") ? <Card kicker={t("members.detail.accessKicker")} title={t("members.detail.accessTitle")}>
            <p className="mx-muted mx-small">{t("members.detail.accessBody")}</p>
          </Card> : null}
        </div>
      </div>

      <PreviewNote>{t("members.detail.previewNote")}</PreviewNote>
    </>
  );
}

function DuesCard({ member, onRecorded }: { member: Member; onRecorded: (result: { membership: Member["membership"]; expiresOn: string }) => void }) {
  const { t, fmt } = useT();
  const [reference, setReference] = useState("");
  const [fieldError, setFieldError] = useState("");
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ref = reference.trim();
    if (ref.length < 3) { setFieldError(t("members.dues.referenceError")); return; }
    setFieldError("");
    const ok = await action.run("dues", async () => {
      const result = await api.post<{ payment: DuesPayment; created: boolean; membership: Member["membership"]; expiresOn: string }>("/api/membership/dues", { memberId: member.id, reference: ref });
      onRecorded(result);
      return result.created
        ? t("members.dues.recorded", { name: member.name, date: fmt.date(result.expiresOn) })
        : t("members.dues.replayed", { reference: ref, name: member.name, date: fmt.date(result.expiresOn) });
    });
    if (ok) setReference("");
  }

  return (
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div>
          <h2>{t("members.dues.title")}</h2>
          <p>{t("members.dues.description")}</p>
        </div>
      </div>
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <form onSubmit={submit} noValidate>
        <div className="form-fields">
          <label>
            {t("members.dues.reference")}
            <input placeholder={t("members.dues.referencePlaceholder")} value={reference} onChange={(e) => { setReference(e.target.value); setFieldError(""); }} aria-invalid={Boolean(fieldError)} disabled={action.busy === "dues"} />
          </label>
          <Button type="submit" variant="primary" loading={action.busy === "dues"}>{t("members.dues.submit")}<Icon name="arrow" size={18} /></Button>
        </div>
        {fieldError ? <p className="form-error" role="alert">{fieldError}</p> : <p className="upload-progress">{t("members.dues.replayHint")}</p>}
      </form>
    </section>
  );
}

function RoleCard({ member, isSelf, onChanged }: { member: Member; isSelf: boolean; onChanged: (next: Partial<Member>) => void }) {
  const { t, apiError } = useT();
  const [role, setRole] = useState<Role>(member.role);
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === member.role) { action.setError(t("members.role.pickDifferent")); return; }
    await action.run("role", async () => {
      try {
        const result = await api.patch<{ member: Member }>(`/api/members/${encodeURIComponent(member.id)}/role`, { role });
        onChanged({ role: result.member.role });
        return t("members.role.changed", { name: member.name, role: t(`role.${result.member.role}`) });
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) throw new Error(t("members.role.ownRole"));
        throw new Error(apiError(caught) || t("members.role.failed"));
      }
    });
  }

  return (
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>{t("members.role.title")}</h2><p>{t("members.role.description")}</p></div>
      </div>
      {isSelf ? <p className="mx-muted mx-small">{t("members.role.self")}</p> : (
        <form onSubmit={submit} noValidate>
          {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <div className="task-form-grid">
            <label>
              {t("members.role.label")}
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={action.busy === "role"}>
                {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={action.busy === "role"} disabled={role === member.role}>{t("members.role.submit")}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function PasswordCard({ member }: { member: Member }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8 || password.length > 200) next.password = t("members.password.lengthError");
    if (confirm !== password) next.confirm = t("members.password.mismatch");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await action.run("password", async () => {
      await api.post<{ ok: true }>(`/api/members/${encodeURIComponent(member.id)}/password`, { password });
      return t("members.password.done", { name: member.name });
    });
    if (ok) { setPassword(""); setConfirm(""); }
  }

  return (
    <section className="panel task-create-panel">
      <div className="form-heading">
        <div><h2>{t("members.password.title")}</h2><p>{t("members.password.description")}</p></div>
      </div>
      <form onSubmit={submit} noValidate>
        {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
        <div className="task-form-grid">
          <label>
            {t("members.password.new")}
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((c) => ({ ...c, password: undefined })); }} aria-invalid={Boolean(errors.password)} disabled={action.busy === "password"} />
          </label>
          <label>
            {t("members.password.confirm")}
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((c) => ({ ...c, confirm: undefined })); }} aria-invalid={Boolean(errors.confirm)} disabled={action.busy === "password"} />
          </label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "password"}>{t("members.password.submit")}</Button>
        </div>
        {errors.password || errors.confirm ? <p className="form-error" role="alert">{errors.password ?? errors.confirm}</p> : null}
      </form>
    </section>
  );
}
