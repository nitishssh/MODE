"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_RECEIPT_SIZE_BYTES, type EventDetails, type Expense, type Receipt } from "@/lib/contracts";
import { api, newId, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { dateTime, money, rupeesToPaise } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, Modal, PageHead, SelectField, Skeleton, Stat, StatusBadge, Table, Tabs, TextField, TextareaField } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type ReviewTab = "submitted" | "approved" | "paid" | "rejected" | "all";
type View = "mine" | "review";

const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Timeline({ expense }: { expense: Expense }) {
  return (
    <small className="mx-cell-sub">
      Submitted {dateTime(expense.submittedAt)}
      {expense.reviewedAt ? ` · ${expense.status === "rejected" ? "Rejected" : "Approved"} ${dateTime(expense.reviewedAt)}` : ""}
      {expense.paidAt ? ` · Paid ${dateTime(expense.paidAt)}` : ""}
      {expense.rejectionNote ? ` · Note: ${expense.rejectionNote}` : ""}
      {expense.paymentReference ? ` · Ref ${expense.paymentReference}` : ""}
    </small>
  );
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

  // Submission form
  const [submitOpen, setSubmitOpen] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => newId());
  const [form, setForm] = useState({ amount: "", purpose: "", receiptReference: "", eventId: "" });
  const [formErrors, setFormErrors] = useState<{ amount?: string; purpose?: string; receipt?: string }>({});

  // Review modals
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

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError("");
    setReceipt(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) { setFileError("Use a JPG, PNG or PDF receipt."); return; }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) { setFileError("Receipt is too large. Maximum size is 5 MB."); return; }
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const ok = await action.run("upload", async () => {
      const uploaded = await api.post<Receipt>("/api/receipts", body);
      setReceipt(uploaded);
      setFormErrors((c) => ({ ...c, receipt: undefined }));
    });
    if (!ok) setFileError(action.error || "Upload failed.");
    setUploading(false);
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: typeof formErrors = {};
    const amountPaise = rupeesToPaise(form.amount);
    if (!amountPaise || amountPaise <= 0) errors.amount = "Enter an amount in rupees, e.g. 349.50.";
    const purpose = form.purpose.trim();
    if (purpose.length < 3) errors.purpose = "Describe the purpose (at least 3 characters).";
    if (!receipt) errors.receipt = "Upload the receipt first.";
    setFormErrors(errors);
    if (Object.keys(errors).length || !receipt || !amountPaise) return;
    const body: Record<string, unknown> = { submissionId, amountPaise, purpose, receiptId: receipt.id };
    if (form.receiptReference.trim()) body.receiptReference = form.receiptReference.trim();
    if (form.eventId) body.eventId = form.eventId;
    const ok = await action.run("submit", async () => {
      const created = await api.post<Expense>("/api/expenses", body);
      expenses.setData((current) => [created, ...(current ?? []).filter((e) => e.id !== created.id)]);
      return "Claim submitted for review.";
    });
    if (ok) {
      setSubmitOpen(false);
      setReceipt(null);
      setForm({ amount: "", purpose: "", receiptReference: "", eventId: "" });
      setSubmissionId(newId());
      setView("mine");
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

  function renderRows(rows: Expense[], reviewer: boolean) {
    return rows.map((expense) => {
      const own = user !== null && expense.submitterId === user.id;
      const busy = action.busy?.endsWith(`:${expense.id}`) ?? false;
      return (
        <tr key={expense.id}>
          {reviewer ? <td><span className="mx-cell-title">{expense.submitterName}</span>{own ? <span className="mx-cell-sub">Your own claim</span> : null}</td> : null}
          <td>
            <span className="mx-cell-title">{expense.purpose}</span>
            <Timeline expense={expense} />
          </td>
          <td className="num"><span className="mx-strong">{money(expense.amountPaise)}</span></td>
          <td>{expense.eventTitle ?? <span className="mx-muted">—</span>}</td>
          <td><StatusBadge status={expense.status} /></td>
          <td className="actions">
            {expense.receiptId ? <a className="mx-btn sm" href={`/api/receipts/${encodeURIComponent(expense.receiptId)}`} target="_blank" rel="noopener noreferrer"><Icon.receipt />Receipt</a> : <span className="mx-muted mx-small">No receipt</span>}
            {reviewer && expense.status === "submitted" ? (
              <>
                {" "}<Button size="sm" variant="primary" disabled={own} loading={action.busy === `approve:${expense.id}`} onClick={() => void approve(expense)} title={own ? "You cannot review your own claim" : undefined}><Icon.check />Approve</Button>
                {" "}<Button size="sm" variant="danger" disabled={own || busy} onClick={() => setReject({ expense, note: "" })} title={own ? "You cannot review your own claim" : undefined}>Reject</Button>
              </>
            ) : null}
            {reviewer && expense.status === "approved" ? (
              <>{" "}<Button size="sm" variant="accent" disabled={own || busy} onClick={() => setPay({ expense, reference: "" })} title={own ? "You cannot pay your own claim" : undefined}><Icon.wallet />Pay</Button></>
            ) : null}
          </td>
        </tr>
      );
    });
  }

  return (
    <>
      <PageHead
        eyebrow="Reimbursements"
        title="Expenses"
        description={canReview ? "Review claims, approve what is justified and record payouts against the ledger." : "Submit receipts for reimbursement and follow each claim to payout."}
        actions={canSubmit ? <Button variant="primary" onClick={() => { setSubmitOpen(true); action.clear(); }}><Icon.plus />Submit a claim</Button> : null}
      />

      {action.error && !submitOpen && !reject && !pay ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}

      {canReview ? (
        <div className="mx-grid mx-grid-4 mx-mb">
          <Stat label="Awaiting review" value={expenses.data ? counts.submitted : "—"} tone="amber" />
          <Stat label="Approved, unpaid" value={expenses.data ? counts.approved : "—"} tone="blue" />
          <Stat label="Paid" value={expenses.data ? counts.paid : "—"} tone="green" />
          <Stat label="Rejected" value={expenses.data ? counts.rejected : "—"} />
        </div>
      ) : null}

      {canReview ? (
        <Tabs value={view} onChange={setView} items={[{ value: "review", label: "Club claims", count: counts.all }, { value: "mine", label: "My claims", count: mine.length }]} />
      ) : null}

      {expenses.error ? <ErrorState error={expenses.error} onRetry={expenses.reload} /> : expenses.loading && !expenses.data ? <Skeleton rows={6} /> : canReview && view === "review" ? (
        <Card title="Club claims" actions={<Button size="sm" variant="ghost" onClick={() => void expenses.reload()}><Icon.refresh />Refresh</Button>}>
          <Tabs value={reviewTab} onChange={setReviewTab} items={[
            { value: "submitted", label: "Submitted", count: counts.submitted },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "paid", label: "Paid", count: counts.paid },
            { value: "rejected", label: "Rejected", count: counts.rejected },
            { value: "all", label: "All", count: counts.all },
          ]} />
          <Table
            head={<><th>Submitter</th><th>Purpose</th><th className="num">Amount</th><th>Event</th><th>Status</th><th className="actions">Actions</th></>}
            empty={!reviewRows.length ? <EmptyState title="Nothing here">No claims with this status.</EmptyState> : undefined}
          >
            {renderRows(reviewRows, true)}
          </Table>
        </Card>
      ) : (
        <Card title="My claims" actions={<Button size="sm" variant="ghost" onClick={() => void expenses.reload()}><Icon.refresh />Refresh</Button>}>
          <Table
            head={<><th>Purpose</th><th className="num">Amount</th><th>Event</th><th>Status</th><th className="actions">Receipt</th></>}
            empty={!mine.length ? <EmptyState title="No claims yet" action={canSubmit ? <Button onClick={() => setSubmitOpen(true)}><Icon.plus />Submit your first claim</Button> : undefined}>Upload a receipt and tell the treasurer what it was for.</EmptyState> : undefined}
          >
            {renderRows(mine, false)}
          </Table>
        </Card>
      )}

      <Modal open={submitOpen} title="Submit a claim" description="Reimbursement is recorded after a treasurer approves and pays the claim." onClose={() => setSubmitOpen(false)}>
        <form className="mx-form" onSubmit={submitClaim} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <div className="mx-field">
            <label htmlFor="receipt-file">1. Receipt (JPG, PNG or PDF, up to 5 MB)</label>
            <div className="mx-file">
              {receipt ? <span><Icon.check style={{ verticalAlign: "middle", color: "var(--mx-green)" }} /> {receipt.filename} · {fileSize(receipt.sizeBytes)}</span> : uploading ? <span>Uploading…</span> : <span>Choose the receipt file to upload it.</span>}
              <input id="receipt-file" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => void onFile(e)} disabled={uploading} />
            </div>
            {fileError || formErrors.receipt ? <span className="mx-error" role="alert">{fileError || formErrors.receipt}</span> : null}
          </div>
          <p className="mx-label">2. Claim details</p>
          <div className="mx-form-row">
            <TextField label="Amount (₹)" inputMode="decimal" placeholder="349.50" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} error={formErrors.amount} />
            <SelectField label="Event (optional)" value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}>
              <option value="">Not tied to an event</option>
              {eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </SelectField>
          </div>
          <TextareaField label="Purpose" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} maxLength={500} error={formErrors.purpose} placeholder="What was bought and why" />
          <TextField label="Receipt reference (optional)" value={form.receiptReference} onChange={(e) => setForm((f) => ({ ...f, receiptReference: e.target.value }))} maxLength={200} hint="Invoice or bill number, if any." />
          <div className="mx-form-actions">
            <Button onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!receipt || uploading} loading={action.busy === "submit"}>Submit claim</Button>
          </div>
        </form>
      </Modal>

      <Modal open={reject !== null} title="Reject claim" description={reject ? `${reject.expense.submitterName} · ${money(reject.expense.amountPaise)} · ${reject.expense.purpose}` : undefined} onClose={() => setReject(null)}>
        <form className="mx-form" onSubmit={confirmReject} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <TextareaField label="Note to the submitter (optional)" value={reject?.note ?? ""} onChange={(e) => setReject((r) => (r ? { ...r, note: e.target.value } : r))} maxLength={500} />
          <div className="mx-form-actions">
            <Button onClick={() => setReject(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={reject ? action.busy === `reject:${reject.expense.id}` : false}>Reject claim</Button>
          </div>
        </form>
      </Modal>

      <Modal open={pay !== null} title="Record payout" description={pay ? `${pay.expense.submitterName} · ${money(pay.expense.amountPaise)} · ${pay.expense.purpose}` : undefined} onClose={() => setPay(null)}>
        <form className="mx-form" onSubmit={confirmPay} noValidate>
          {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
          <Alert tone="info">This records a reimbursement already paid outside MODE (UPI, bank, cash). It posts one expense entry to the ledger and does not move money.</Alert>
          <TextField label="Payment reference" value={pay?.reference ?? ""} onChange={(e) => setPay((p) => (p ? { ...p, reference: e.target.value } : p))} maxLength={200} placeholder="UPI / bank transaction id" autoFocus />
          <div className="mx-form-actions">
            <Button onClick={() => setPay(null)}>Cancel</Button>
            <Button type="submit" variant="accent" loading={pay ? action.busy === `pay:${pay.expense.id}` : false}>Mark as paid</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
