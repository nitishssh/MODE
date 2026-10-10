"use client";

import { useMemo, useState, type FormEvent } from "react";
import { MAX_RECEIPT_SIZE_BYTES, type EventDetails, type Expense, type Receipt } from "@/lib/contracts";
import { api, describeError, newId, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { amount, date, money } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, FormPanel, Loading, Modal, PageHead, PreviewNote, Stat, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's MyExpenses (inline submit panel + claims table) plus the treasury
 * expense approvals (approve / reject / mark paid) for reviewers. */

type ReviewTab = "submitted" | "approved" | "paid" | "rejected" | "all";
type View = "mine" | "review";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];
const STATUS_CLASS: Record<string, string> = { submitted: "amber", approved: "purple", rejected: "red", paid: "green" };
const STATUS_LABEL: Record<string, string> = { submitted: "Submitted", approved: "Approved", rejected: "Rejected", paid: "Paid" };

function Notes({ expense }: { expense: Expense }) {
  if (expense.status === "rejected" && expense.rejectionNote) return <span className="rejection-note">{expense.rejectionNote}</span>;
  if (expense.status === "paid" && expense.paymentReference) return <span className="payment-ref">Ref {expense.paymentReference}</span>;
  if (expense.status === "approved") return <span className="subtext">Approved · awaiting payout</span>;
  if (expense.status === "submitted") return <span className="subtext">Awaiting review</span>;
  return null;
}

export default function ExpensesPage() {
  const { user, can } = useSession();
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

  function replace(updated: Expense) {
    expenses.setData((current) => (current ?? []).map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const amountRupees = Number(fd.get("amount"));
    const amountPaise = Math.round(amountRupees * 100);
    const purpose = String(fd.get("purpose") ?? "").trim();
    const receiptReference = String(fd.get("receiptReference") ?? "").trim();
    const eventId = String(fd.get("eventId") ?? "");
    const file = fd.get("receiptFile");
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) { setSubmitError("Enter an amount in rupees, e.g. 349.50."); return; }
    if (purpose.length < 3) { setSubmitError("Describe the purpose (at least 3 characters)."); return; }
    if (!(file instanceof File) || !file.size) { setSubmitError("Attach the receipt (JPG, PNG or PDF)."); return; }
    if (!ACCEPTED.includes(file.type)) { setSubmitError("Use a JPG, PNG or PDF receipt."); return; }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) { setSubmitError("Receipt is too large. Maximum size is 5 MB."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      setUploadProgress("Uploading receipt…");
      const upload = new FormData();
      upload.append("file", file);
      const receipt = await api.post<Receipt>("/api/receipts", upload);
      setUploadProgress("Submitting claim…");
      const body: Record<string, unknown> = { submissionId, amountPaise, purpose, receiptId: receipt.id };
      if (receiptReference) body.receiptReference = receiptReference;
      if (eventId) body.eventId = eventId;
      const created = await api.post<Expense>("/api/expenses", body);
      expenses.setData((current) => [created, ...(current ?? []).filter((e) => e.id !== created.id)]);
      form.reset();
      setShowForm(false);
      setSubmissionId(newId());
      setView("mine");
      action.setNotice("Expense submitted for review.");
    } catch (caught) {
      setSubmitError(describeError(caught, "Could not submit the expense."));
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  async function approve(expense: Expense) {
    await action.run(`approve:${expense.id}`, async () => {
      replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(expense.id)}/approve`, {}));
      return "Claim approved.";
    });
  }

  async function confirmReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reject) return;
    const body: Record<string, unknown> = {};
    if (reject.note.trim()) body.note = reject.note.trim();
    const ok = await action.run(`reject:${reject.expense.id}`, async () => {
      replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(reject.expense.id)}/reject`, body));
      return "Claim rejected.";
    });
    if (ok) setReject(null);
  }

  async function confirmPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pay) return;
    const reference = pay.reference.trim();
    if (!reference) { action.setError("Enter the payment reference."); return; }
    const ok = await action.run(`pay:${pay.expense.id}`, async () => {
      replace(await api.post<Expense>(`/api/expenses/${encodeURIComponent(pay.expense.id)}/pay`, { paymentReference: reference }));
      return "Reimbursement recorded in the ledger.";
    });
    if (ok) setPay(null);
  }

  const eventOptions = events.data?.events ?? [];

  const myTable = (
    <Card kicker="MY CLAIMS" title="Reimbursement requests" flush action={{ label: "Refresh", onClick: () => void expenses.reload() }}>
      {!mine.length ? (
        <EmptyState title="No claims yet" icon="receipt">Upload a receipt and tell the treasurer what it was for.</EmptyState>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">Purpose</th><th scope="col" className="amount-cell">Amount</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Notes</th></tr></thead>
            <tbody>
              {mine.map((exp) => (
                <tr key={exp.id}>
                  <td>
                    <strong>{exp.purpose}</strong>
                    {exp.eventTitle ? <span className="subtext"><Icon name="calendar" size={10} /> {exp.eventTitle}</span> : null}
                    {exp.receiptId ? <span className="subtext"><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">View receipt</a></span> : null}
                  </td>
                  <td className="amount-cell">{amount(exp.amountPaise)}</td>
                  <td>{date(exp.submittedAt)}</td>
                  <td><span className={`badge ${STATUS_CLASS[exp.status] ?? "neutral"}`}>{STATUS_LABEL[exp.status] ?? exp.status}</span></td>
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
    <Card kicker="TREASURY" title="Club claims" flush action={{ label: "Refresh", onClick: () => void expenses.reload() }}>
      <div style={{ padding: "0 25px" }}>
        <Tabs value={reviewTab} onChange={setReviewTab} items={[
          { value: "submitted", label: "Pending", count: counts.submitted },
          { value: "approved", label: "Ready to pay", count: counts.approved },
          { value: "paid", label: "Paid", count: counts.paid },
          { value: "rejected", label: "Rejected", count: counts.rejected },
          { value: "all", label: "All", count: counts.all },
        ]} />
      </div>
      {!reviewRows.length ? (
        <EmptyState title="Nothing here" icon="receipt">No claims with this status.</EmptyState>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">Submitted by</th><th scope="col">Purpose</th><th scope="col" className="amount-cell">Amount</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {reviewRows.map((exp) => {
                const own = user !== null && exp.submitterId === user.id;
                const busy = action.busy?.endsWith(`:${exp.id}`) ?? false;
                return (
                  <tr key={exp.id}>
                    <td><strong>{exp.submitterName}</strong>{own ? <span className="subtext">Your own claim</span> : null}</td>
                    <td>
                      {exp.purpose}
                      {exp.eventTitle ? <div className="subtext"><Icon name="calendar" size={10} /> {exp.eventTitle}</div> : null}
                      {exp.receiptId ? <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">View receipt</a></div> : null}
                      {exp.receiptReference ? <div className="subtext">Receipt ref: {exp.receiptReference}</div> : null}
                    </td>
                    <td className="amount-cell">{amount(exp.amountPaise)}</td>
                    <td>{date(exp.submittedAt)}</td>
                    <td><span className={`badge ${STATUS_CLASS[exp.status] ?? "neutral"}`}>{STATUS_LABEL[exp.status] ?? exp.status}</span><Notes expense={exp} /></td>
                    <td>
                      <div className="expense-action-row">
                        {exp.status === "submitted" ? (
                          <>
                            <button type="button" className="button-small green-btn" disabled={own || busy} title={own ? "You cannot review your own claim" : undefined} onClick={() => void approve(exp)}>Approve</button>
                            <button type="button" className="button-small red-btn" disabled={own || busy} title={own ? "You cannot review your own claim" : undefined} onClick={() => setReject({ expense: exp, note: "" })}>Reject</button>
                          </>
                        ) : null}
                        {exp.status === "approved" ? (
                          <button type="button" className="button-small" disabled={own || busy} title={own ? "You cannot pay your own claim" : undefined} onClick={() => setPay({ expense: exp, reference: "" })}>Mark paid</button>
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

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> EXPENSES</>}
        title={canReview ? "Expenses" : "My Expenses"}
        description={canReview ? "Review claims, approve what is justified and record payouts against the ledger." : "Submit receipts for reimbursement and follow each claim to payout."}
      />

      {action.error && !reject && !pay ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}

      {canReview ? (
        <section className="metrics-grid" aria-label="Claims summary">
          <Stat label="Awaiting review" value={expenses.data ? String(counts.submitted).padStart(2, "0") : "—"} hint="Claims waiting for a decision" tone="amber" icon="clock" />
          <Stat label="Approved, unpaid" value={expenses.data ? String(counts.approved).padStart(2, "0") : "—"} hint="Ready for payout" tone="blue" icon="receipt" />
          <Stat label="Paid" value={expenses.data ? String(counts.paid).padStart(2, "0") : "—"} hint="Recorded in the ledger" tone="green" icon="check" />
          <Stat label="Rejected" value={expenses.data ? String(counts.rejected).padStart(2, "0") : "—"} hint="Declined with a note" tone="dark" icon="alert" />
        </section>
      ) : null}

      <div className="task-toolbar">
        {canReview ? (
          <Tabs value={view} onChange={setView} items={[{ value: "review", label: "Club claims", count: counts.all }, { value: "mine", label: "My claims", count: mine.length }]} />
        ) : <div />}
        {canSubmit ? (
          <Button variant="primary" onClick={() => { setShowForm(true); setSubmitError(""); action.clear(); }}><Icon name="plus" size={16} />Submit expense</Button>
        ) : null}
      </div>

      {showForm && canSubmit ? (
        <FormPanel title="Submit an expense" description={<>Submitting as <strong>{user?.name ?? "you"}</strong>. Reimbursement is recorded after a treasurer approves and pays the claim.</>} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit}>
            <div className="task-form-grid">
              <label>Amount (₹)<input name="amount" type="number" step="0.01" min="0.01" placeholder="349.50" required disabled={submitting} /></label>
              <label>Purpose<input name="purpose" placeholder="What was bought and why" minLength={3} maxLength={500} required disabled={submitting} /></label>
              <label>Receipt reference<input name="receiptReference" placeholder="Invoice or bill number (optional)" maxLength={200} disabled={submitting} /></label>
              <label>Event<select name="eventId" disabled={submitting}><option value="">No event</option>{eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
              <label>Receipt file (JPG, PNG or PDF, up to 5 MB)<input name="receiptFile" type="file" accept="image/jpeg,image/png,application/pdf" required disabled={submitting} /></label>
            </div>
            {uploadProgress ? <p className="upload-progress" aria-live="polite"><span className="loader" />{uploadProgress}</p> : null}
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={submitting}>{submitting ? "Submitting…" : "Submit expense"}</button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</button>
            </div>
            {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
          </form>
        </FormPanel>
      ) : null}

      {expenses.error ? <ErrorState error={expenses.error} onRetry={expenses.reload} title="Expenses could not load" /> : expenses.loading && !expenses.data ? <Loading label="Loading expenses…" /> : canReview && view === "review" ? reviewTable : myTable}

      <PreviewNote>Payment records a reimbursement already made outside MODE. Officers cannot review or pay their own claims.</PreviewNote>

      <Modal open={reject !== null} title="Reject claim" description={reject ? `${reject.expense.submitterName} · ${money(reject.expense.amountPaise)} · ${reject.expense.purpose}` : undefined} onClose={() => setReject(null)}>
        <form className="task-edit-form" style={{ border: 0, margin: 0, padding: 0 }} onSubmit={confirmReject} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <label>Note to the submitter (optional)<textarea value={reject?.note ?? ""} onChange={(e) => setReject((r) => (r ? { ...r, note: e.target.value } : r))} maxLength={500} rows={3} /></label>
          <div className="form-actions">
            <button type="submit" className="button-small red-btn" disabled={reject ? action.busy === `reject:${reject.expense.id}` : false}>Reject claim</button>
            <button type="button" className="button-small" onClick={() => setReject(null)}>Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={pay !== null} title="Mark as paid" description={pay ? `${pay.expense.submitterName} · ${money(pay.expense.amountPaise)} · ${pay.expense.purpose}` : undefined} onClose={() => setPay(null)}>
        <form className="task-edit-form" style={{ border: 0, margin: 0, padding: 0 }} onSubmit={confirmPay} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <div className="outstanding-notice"><Icon name="alert" size={16} /><div>This records a reimbursement already paid outside MODE (UPI, bank, cash). It posts one expense entry to the ledger and does not move money.</div></div>
          <label>Payment reference<input value={pay?.reference ?? ""} onChange={(e) => setPay((p) => (p ? { ...p, reference: e.target.value } : p))} maxLength={200} placeholder="UPI / bank transaction id" autoFocus /></label>
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={pay ? action.busy === `pay:${pay.expense.id}` : false}>Mark as paid</button>
            <button type="button" className="button secondary" onClick={() => setPay(null)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
