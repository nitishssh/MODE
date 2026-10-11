"use client";

import { useMemo, useState, type FormEvent } from "react";
import { MAX_RECEIPT_SIZE_BYTES, type EventDetails, type Expense, type Receipt } from "@/lib/contracts";
import { api, ApiError, newId, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";
import { Alert, Button, Card, EmptyState, ErrorState, FormPanel, Loading, Modal, PageHead, PreviewNote, Stat, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's MyExpenses (inline submit panel + claims table) plus the treasury
 * expense approvals (approve / reject / mark paid) for reviewers. */

type ReviewTab = "submitted" | "approved" | "paid" | "rejected" | "all";
type View = "mine" | "review";
type ExpenseStatus = Expense["status"];

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const STATUS_CLASS: Record<string, string> = { submitted: "amber", approved: "purple", rejected: "red", paid: "green" };

function Notes({ expense }: { expense: Expense }) {
  const { t } = useT();
  if (expense.status === "rejected" && expense.rejectionNote) return <span className="rejection-note">{expense.rejectionNote}</span>;
  if (expense.status === "paid" && expense.paymentReference) return <span className="payment-ref">{t("expenses.notes.ref", { reference: expense.paymentReference })}</span>;
  if (expense.status === "approved") return <span className="subtext">{t("expenses.notes.approved")}</span>;
  if (expense.status === "submitted") return <span className="subtext">{t("expenses.notes.awaitingReview")}</span>;
  return null;
}

export default function ExpensesPage() {
  const { user, can } = useSession();
  const { t, fmt, apiError } = useT();
  const canReview = can("expenses:review");
  const canSubmit = can("expenses:submit");

  const expenses = useLoad(() => api.get<Expense[]>("/api/expenses"));
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));
  const action = useAction();

  const [view, setView] = useState<View>("mine");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("submitted");

  // Submission form (kept until success so retries reuse the same submissionId).
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submissionId, setSubmissionId] = useState(() => newId());
  const [pendingSubmission, setPendingSubmission] = useState<Record<string, unknown> | null>(null);

  const [reject, setReject] = useState<{ expense: Expense; note: string } | null>(null);
  const [pay, setPay] = useState<{ expense: Expense; reference: string } | null>(null);

  const all = useMemo(() => expenses.data ?? [], [expenses.data]);
  const mine = useMemo(() => all.filter((e) => user !== null && e.submitterId === user.id), [all, user]);
  const reviewRows = useMemo(() => (reviewTab === "all" ? all : all.filter((e) => e.status === reviewTab)), [all, reviewTab]);
  const counts = useMemo(() => ({
    submitted: all.filter((e) => e.status === "submitted").length,
    approved: all.filter((e) => e.status === "approved").length,
    paid: all.filter((e) => e.status === "paid").length,
    rejected: all.filter((e) => e.status === "rejected").length,
    all: all.length,
  }), [all]);

  const statusLabel = (status: ExpenseStatus) => t(`status.${status}`);

  function replace(updated: Expense) {
    expenses.setData((current) => (current ?? []).map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    if (pendingSubmission) {
      setSubmitting(true);
      setSubmitError("");
      try { await sendClaim(pendingSubmission, form); }
      catch (caught) { handleClaimError(caught); }
      finally { setSubmitting(false); }
      return;
    }
    const fd = new FormData(form);
    const amountRupees = Number(fd.get("amount"));
    const amountPaise = Math.round(amountRupees * 100);
    const purpose = String(fd.get("purpose") ?? "").trim();
    const receiptReference = String(fd.get("receiptReference") ?? "").trim();
    const eventId = String(fd.get("eventId") ?? "");
    const file = fd.get("receiptFile");
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setSubmitError(t("expenses.error.amountInvalid")); return; }
    if (purpose.length < 3) { setSubmitError(t("expenses.error.purposeShort")); return; }
    if (!(file instanceof File) || !file.size) { setSubmitError(t("expenses.error.receiptMissing")); return; }
    if (!ACCEPTED.includes(file.type)) { setSubmitError(t("expenses.error.receiptType")); return; }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) { setSubmitError(t("expenses.error.receiptTooLarge")); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      setUploadProgress(t("expenses.progress.uploading"));
      const upload = new FormData();
      upload.append("file", file);
      const receipt = await api.post<Receipt>("/api/receipts", upload);
      setUploadProgress(t("expenses.progress.submitting"));
      const body: Record<string, unknown> = { submissionId, amountPaise, purpose, receiptId: receipt.id };
      if (receiptReference) body.receiptReference = receiptReference;
      if (eventId) body.eventId = eventId;
      setPendingSubmission(body);
      await sendClaim(body, form);
    } catch (caught) {
      handleClaimError(caught);
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  function handleClaimError(caught: unknown) {
    // A timeout, lost response or unreadable success may already have committed.
    // Keep the exact receipt and payload until the server resolves that attempt.
    if (caught instanceof ApiError && [400, 401, 403, 404, 413, 415].includes(caught.status)) setPendingSubmission(null);
    setSubmitError(apiError(caught, "expenses.error.submitFailed"));
  }

  async function sendClaim(body: Record<string, unknown>, form: HTMLFormElement) {
    let created: Expense;
    try { created = await api.post<Expense>("/api/expenses", body); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      // A conflict is definitive, but may describe an already saved claim.
      // If reconciliation itself fails, retain the immutable attempt for retry.
      let claims: Expense[];
      try { claims = await api.get<Expense[]>("/api/expenses"); }
      catch (cause) {
        throw new Error("Could not confirm whether the claim was saved. Retry the same claim when your connection and session are restored.", { cause });
      }
      const saved = claims.find((claim) => claim.id === body.submissionId);
      if (!saved) {
        setPendingSubmission(null);
        setSubmissionId(newId());
        throw error;
      }
      created = saved;
    }
    expenses.setData((current) => [created, ...(current ?? []).filter((e) => e.id !== created.id)]);
    setPendingSubmission(null);
    form.reset();
    setShowForm(false);
    setSubmissionId(newId());
    setView("mine");
    action.setNotice(t("expenses.submitted"));
  }

  async function approve(expense: Expense) {
    await action.run(`approve:${expense.id}`, async () => {
      try {
        replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(expense.id)}/approve`, {}));
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      return t("expenses.approved");
    });
  }

  async function confirmReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reject) return;
    const body: Record<string, unknown> = {};
    if (reject.note.trim()) body.note = reject.note.trim();
    const ok = await action.run(`reject:${reject.expense.id}`, async () => {
      try {
        replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(reject.expense.id)}/reject`, body));
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      return t("expenses.rejected");
    });
    if (ok) setReject(null);
  }

  async function confirmPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pay) return;
    const reference = pay.reference.trim();
    if (!reference) { action.setError(t("expenses.error.referenceRequired")); return; }
    const ok = await action.run(`pay:${pay.expense.id}`, async () => {
      try {
        replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(pay.expense.id)}/pay`, { paymentReference: reference }));
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      return t("expenses.paidRecorded");
    });
    if (ok) setPay(null);
  }

  const eventOptions = events.data?.events ?? [];

  const myTable = (
    <Card kicker={t("expenses.mine.kicker")} title={t("expenses.mine.title")} flush action={{ label: t("action.refresh"), onClick: () => void expenses.reload() }}>
      {!mine.length ? (
        <EmptyState title={t("expenses.mine.emptyTitle")} icon="receipt">{t("expenses.mine.emptyBody")}</EmptyState>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">{t("col.purpose")}</th><th scope="col" className="amount-cell">{t("col.amount")}</th><th scope="col">{t("col.date")}</th><th scope="col">{t("col.status")}</th><th scope="col">{t("col.notes")}</th></tr></thead>
            <tbody>
              {mine.map((exp) => (
                <tr key={exp.id}>
                  <td>
                    <strong>{exp.purpose}</strong>
                    {exp.eventTitle ? <span className="subtext"><Icon name="calendar" size={10} /> {exp.eventTitle}</span> : null}
                    {exp.receiptId ? <span className="subtext"><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">{t("expenses.viewReceipt")}</a></span> : null}
                  </td>
                  <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                  <td>{fmt.date(exp.submittedAt)}</td>
                  <td><span className={`badge ${STATUS_CLASS[exp.status] ?? "neutral"}`}>{statusLabel(exp.status)}</span></td>
                  <td><Notes expense={exp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  const reviewTable = (
    <Card kicker={t("expenses.review.kicker")} title={t("expenses.review.title")} flush action={{ label: t("action.refresh"), onClick: () => void expenses.reload() }}>
      <div style={{ padding: "0 25px" }}>
        <Tabs value={reviewTab} onChange={setReviewTab} items={[
          { value: "submitted", label: t("expenses.review.tab.pending"), count: counts.submitted },
          { value: "approved", label: t("expenses.review.tab.readyToPay"), count: counts.approved },
          { value: "paid", label: t("status.paid"), count: counts.paid },
          { value: "rejected", label: t("status.rejected"), count: counts.rejected },
          { value: "all", label: t("expenses.review.tab.all"), count: counts.all },
        ]} />
      </div>
      {!reviewRows.length ? (
        <EmptyState title={t("expenses.review.emptyTitle")} icon="receipt">{t("expenses.review.emptyBody")}</EmptyState>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">{t("expenses.review.submittedBy")}</th><th scope="col">{t("col.purpose")}</th><th scope="col" className="amount-cell">{t("col.amount")}</th><th scope="col">{t("col.date")}</th><th scope="col">{t("col.status")}</th><th scope="col">{t("col.actions")}</th></tr></thead>
            <tbody>
              {reviewRows.map((exp) => {
                const own = user !== null && exp.submitterId === user.id;
                const busy = action.busy?.endsWith(`:${exp.id}`) ?? false;
                return (
                  <tr key={exp.id}>
                    <td><strong>{exp.submitterName}</strong>{own ? <span className="subtext">{t("expenses.review.ownClaim")}</span> : null}</td>
                    <td>
                      {exp.purpose}
                      {exp.eventTitle ? <div className="subtext"><Icon name="calendar" size={10} /> {exp.eventTitle}</div> : null}
                      {exp.receiptId ? <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">{t("expenses.viewReceipt")}</a></div> : null}
                      {exp.receiptReference ? <div className="subtext">{t("expenses.review.receiptRef", { reference: exp.receiptReference })}</div> : null}
                    </td>
                    <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                    <td>{fmt.date(exp.submittedAt)}</td>
                    <td><span className={`badge ${STATUS_CLASS[exp.status] ?? "neutral"}`}>{statusLabel(exp.status)}</span><Notes expense={exp} /></td>
                    <td>
                      <div className="expense-action-row">
                        {exp.status === "submitted" ? (
                          <>
                            <button type="button" className="button-small green-btn" disabled={own || busy} title={own ? t("expenses.review.cannotReviewOwn") : undefined} onClick={() => void approve(exp)}>{t("expenses.review.approve")}</button>
                            <button type="button" className="button-small red-btn" disabled={own || busy} title={own ? t("expenses.review.cannotReviewOwn") : undefined} onClick={() => setReject({ expense: exp, note: "" })}>{t("expenses.review.reject")}</button>
                          </>
                        ) : null}
                        {exp.status === "approved" ? (
                          <button type="button" className="button-small" disabled={own || busy} title={own ? t("expenses.review.cannotPayOwn") : undefined} onClick={() => setPay({ expense: exp, reference: "" })}>{t("expenses.review.markPaid")}</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  const modalDescription = (expense: Expense) => `${expense.submitterName} · ${fmt.currency(expense.amountPaise)} · ${expense.purpose}`;

  return (
    <>
      <PageHead
        eyebrow={<>{t("expenses.eyebrowClub")} <span>/</span> {t("expenses.eyebrow")}</>}
        title={canReview ? t("expenses.title") : t("expenses.titleMine")}
        description={canReview ? t("expenses.descriptionReview") : t("expenses.descriptionMine")}
      />

      {action.error && !reject && !pay ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}

      {canReview ? (
        <section className="metrics-grid" aria-label={t("expenses.summary.ariaLabel")}>
          <Stat label={t("expenses.summary.awaitingReview")} value={expenses.data ? String(counts.submitted).padStart(2, "0") : "—"} hint={t("expenses.summary.awaitingReviewHint")} tone="amber" icon="clock" />
          <Stat label={t("expenses.summary.approvedUnpaid")} value={expenses.data ? String(counts.approved).padStart(2, "0") : "—"} hint={t("expenses.summary.approvedUnpaidHint")} tone="blue" icon="receipt" />
          <Stat label={t("status.paid")} value={expenses.data ? String(counts.paid).padStart(2, "0") : "—"} hint={t("expenses.summary.paidHint")} tone="green" icon="check" />
          <Stat label={t("status.rejected")} value={expenses.data ? String(counts.rejected).padStart(2, "0") : "—"} hint={t("expenses.summary.rejectedHint")} tone="dark" icon="alert" />
        </section>
      ) : null}

      <div className="task-toolbar">
        {canReview ? (
          <Tabs value={view} onChange={setView} items={[{ value: "review", label: t("expenses.view.club"), count: counts.all }, { value: "mine", label: t("expenses.view.mine"), count: mine.length }]} />
        ) : <div />}
        {canSubmit ? (
          <Button variant="primary" onClick={() => { setShowForm(true); setSubmitError(""); action.clear(); }}><Icon name="plus" size={16} />{t("expenses.submitExpense")}</Button>
        ) : null}
      </div>

      {showForm && canSubmit ? (
        <FormPanel title={t("expenses.form.title")} description={<>{t("expenses.form.submittingAs")} <strong>{user?.name ?? t("expenses.form.you")}</strong>. {t("expenses.form.description")}</>} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit}>
            {pendingSubmission ? <p role="status">This claim is awaiting confirmation. Retry the same claim before changing its details; the receipt will not be uploaded again.</p> : null}
            <fieldset disabled={submitting || pendingSubmission !== null} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="task-form-grid">
              <label>{t("expenses.form.amount")}<input name="amount" type="number" step="0.01" min="0.01" placeholder={t("expenses.form.amountPlaceholder")} required disabled={submitting} /></label>
              <label>{t("col.purpose")}<input name="purpose" placeholder={t("expenses.form.purposePlaceholder")} minLength={3} maxLength={500} required disabled={submitting} /></label>
              <label>{t("expenses.form.receiptReference")}<input name="receiptReference" placeholder={t("expenses.form.receiptReferencePlaceholder")} maxLength={200} disabled={submitting} /></label>
              <label>{t("col.event")}<select name="eventId" disabled={submitting}><option value="">{t("expenses.form.noEvent")}</option>{eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
              <label>{t("expenses.form.receiptFile")}<input name="receiptFile" type="file" accept="image/jpeg,image/png,application/pdf" aria-describedby="receipt-privacy-note" required disabled={submitting} /></label>
            </div>
            <p id="receipt-privacy-note" className="mx-muted mx-small">Only the file you select is read. Selecting it does not upload it; Submit expense uploads it for you and authorized club reviewers. Remove unrelated personal details first. <a href="/privacy" target="_blank" rel="noopener">Privacy policy (new tab)</a></p>
            {uploadProgress ? <p className="upload-progress" aria-live="polite"><span className="loader" />{uploadProgress}</p> : null}
            </fieldset>
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={submitting}>{submitting ? t("expenses.form.submitting") : pendingSubmission ? "Retry same claim" : t("expenses.submitExpense")}</button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={submitting}>{t("action.cancel")}</button>
            </div>
            {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
          </form>
        </FormPanel>
      ) : null}

      {expenses.error ? <ErrorState error={expenses.error} onRetry={expenses.reload} title={t("expenses.errorTitle")} /> : expenses.loading && !expenses.data ? <Loading label={t("expenses.loading")} /> : canReview && view === "review" ? reviewTable : myTable}

      <PreviewNote>{t("expenses.note")}</PreviewNote>

      <Modal open={reject !== null} title={t("expenses.rejectModal.title")} description={reject ? modalDescription(reject.expense) : undefined} onClose={() => setReject(null)}>
        <form className="task-edit-form" style={{ border: 0, margin: 0, padding: 0 }} onSubmit={confirmReject} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <label>{t("expenses.rejectModal.note")}<textarea value={reject?.note ?? ""} onChange={(e) => setReject((r) => (r ? { ...r, note: e.target.value } : r))} maxLength={500} rows={3} /></label>
          <div className="form-actions">
            <button type="submit" className="button-small red-btn" disabled={reject ? action.busy === `reject:${reject.expense.id}` : false}>{t("expenses.rejectModal.confirm")}</button>
            <button type="button" className="button-small" onClick={() => setReject(null)}>{t("action.cancel")}</button>
          </div>
        </form>
      </Modal>

      <Modal open={pay !== null} title={t("expenses.payModal.title")} description={pay ? modalDescription(pay.expense) : undefined} onClose={() => setPay(null)}>
        <form className="task-edit-form" style={{ border: 0, margin: 0, padding: 0 }} onSubmit={confirmPay} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <div className="outstanding-notice"><Icon name="alert" size={16} /><div>{t("expenses.payModal.notice")}</div></div>
          <label>{t("expenses.payModal.reference")}<input value={pay?.reference ?? ""} onChange={(e) => setPay((p) => (p ? { ...p, reference: e.target.value } : p))} maxLength={200} placeholder={t("expenses.payModal.referencePlaceholder")} autoFocus /></label>
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={pay ? action.busy === `pay:${pay.expense.id}` : false}>{t("expenses.payModal.confirm")}</button>
            <button type="button" className="button secondary" onClick={() => setPay(null)}>{t("action.cancel")}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
