"use client";

import { useMemo, useState } from "react";
import type { ExpenseLedgerEntry, LedgerSource, LedgerSummary } from "@/lib/contracts";
import { api, ApiError, describeError, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { amount, dateTime, titleCase } from "../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, KeyValue, Loading, Modal, PageHead, Progress, Skeleton, Stat, StatusBadge, Table } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type KindFilter = "all" | "income" | "expense";

function Signed({ entry }: { entry: ExpenseLedgerEntry }) {
  const income = entry.kind === "income";
  return <span className="mx-strong mx-num" style={{ color: income ? "var(--mx-green)" : "var(--mx-red)" }}>{income ? "+" : "−"}{amount(entry.amountPaise)}</span>;
}

function BreakdownTable({ rows }: { rows: { label: string; inflowPaise: number; outflowPaise: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inflowPaise, r.outflowPaise)));
  if (!rows.length) return <p className="mx-muted">No entries yet.</p>;
  return (
    <Table head={<><th>Name</th><th className="num">In</th><th className="num">Out</th><th style={{ width: 160 }}>Share</th></>}>
      {rows.map((row) => (
        <tr key={row.label}>
          <td className="mx-cell-title">{row.label}</td>
          <td className="num" style={{ color: "var(--mx-green)" }}>{amount(row.inflowPaise)}</td>
          <td className="num" style={{ color: "var(--mx-red)" }}>{amount(row.outflowPaise)}</td>
          <td>
            <div className="mx-stack-sm" style={{ gap: 4 }}>
              <Progress value={(row.inflowPaise / max) * 100} />
              <Progress value={(row.outflowPaise / max) * 100} tone="accent" />
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

export default function TreasuryPage() {
  const { can } = useSession();
  const allowed = can("ledger:read");

  const summary = useLoad(() => (allowed ? api.get<LedgerSummary>("/api/ledger/summary") : Promise.resolve(null)), [allowed]);
  const entries = useLoad(() => (allowed ? api.get<ExpenseLedgerEntry[]>("/api/ledger/entries") : Promise.resolve([] as ExpenseLedgerEntry[])), [allowed]);

  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  const [source, setSource] = useState<{ entry: ExpenseLedgerEntry; loading: boolean; data: LedgerSource | null; error: string; notFound: boolean } | null>(null);

  const list = useMemo(() => entries.data ?? [], [entries.data]);
  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of list) if (e.eventId && e.eventTitle) seen.set(e.eventId, e.eventTitle);
    return [...seen.entries()];
  }, [list]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return list.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (eventFilter && e.eventId !== eventFilter) return false;
      if (needle) {
        const hay = [e.description, e.category, e.eventTitle, e.reference, e.recordedByName, e.sourceType].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, kind, search, eventFilter]);

  async function openSource(entry: ExpenseLedgerEntry) {
    setSource({ entry, loading: true, data: null, error: "", notFound: false });
    try {
      const data = await api.get<LedgerSource>(`/api/ledger/entries/${encodeURIComponent(entry.id)}/source`);
      setSource({ entry, loading: false, data, error: "", notFound: false });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setSource({ entry, loading: false, data: null, error: "", notFound: true });
      else setSource({ entry, loading: false, data: null, error: describeError(caught), notFound: false });
    }
  }

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow="Money" title="Treasury" />
        <EmptyState title="Treasurer access only">The ledger, summary and export are visible to treasurers and the club lead.</EmptyState>
      </>
    );
  }

  const s = summary.data;

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Treasury"
        description="One ledger for dues, tickets, merchandise and reimbursements. Balances are computed on the server."
        actions={<>
          <Button variant="ghost" onClick={() => { void summary.reload(); void entries.reload(); }}><Icon.refresh />Refresh</Button>
          <a className="mx-btn primary" href="/api/ledger/export.csv" download><Icon.download />Export CSV</a>
        </>}
      />

      {summary.error ? <div className="mx-mb"><ErrorState error={summary.error} onRetry={summary.reload} /></div> : null}

      <div className="mx-grid mx-grid-4 mx-mb">
        <Stat label="Balance" value={s ? amount(s.balancePaise) : "—"} hint="Income minus paid expenses" tone="blue" />
        <Stat label="Inflow" value={s ? amount(s.inflowPaise) : "—"} hint="Dues, tickets, orders" tone="green" />
        <Stat label="Outflow" value={s ? amount(s.outflowPaise) : "—"} hint="Reimbursements paid" tone="accent" />
        <Stat label="Approved, unpaid" value={s ? amount(s.approvedUnpaidPaise) : "—"} hint="Committed but not yet paid out" tone="amber" />
      </div>

      <div className="mx-grid mx-grid-2 mx-mb">
        <Card title="By category">
          {summary.loading && !s ? <Skeleton rows={3} /> : <BreakdownTable rows={(s?.byCategory ?? []).map((c) => ({ label: c.category, inflowPaise: c.inflowPaise, outflowPaise: c.outflowPaise }))} />}
        </Card>
        <Card title="By event">
          {summary.loading && !s ? <Skeleton rows={3} /> : <BreakdownTable rows={(s?.byEvent ?? []).map((e) => ({ label: e.eventTitle, inflowPaise: e.inflowPaise, outflowPaise: e.outflowPaise }))} />}
        </Card>
      </div>

      <Card title="Register" actions={<span className="mx-muted mx-small">{rows.length} of {list.length} entries</span>}>
        <div className="mx-toolbar">
          <select className="mx-select sm" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} aria-label="Filter by kind">
            <option value="all">Income and expense</option>
            <option value="income">Income only</option>
            <option value="expense">Expense only</option>
          </select>
          <select className="mx-select sm" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event">
            <option value="">All events</option>
            {eventOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
          <input className="mx-input sm" type="search" placeholder="Search description, reference, officer…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search entries" style={{ minWidth: 260 }} />
        </div>
        {entries.error ? <ErrorState error={entries.error} onRetry={entries.reload} /> : entries.loading && !entries.data ? <Skeleton rows={6} /> : (
          <Table
            head={<><th>Date</th><th>Kind</th><th>Description</th><th>Category</th><th>Event</th><th className="num">Amount</th><th>Recorded by</th><th>Reference</th></>}
            empty={!rows.length ? <EmptyState title="No entries">{list.length ? "Nothing matches these filters." : "The ledger is empty."}</EmptyState> : undefined}
          >
            {rows.map((entry) => (
              <tr key={entry.id} className="clickable" onClick={() => void openSource(entry)} title="Show source record">
                <td style={{ whiteSpace: "nowrap" }}>{dateTime(entry.occurredAt)}</td>
                <td><StatusBadge status={entry.kind} /></td>
                <td><span className="mx-cell-title">{entry.description}</span><span className="mx-cell-sub">{titleCase(entry.sourceType)}</span></td>
                <td>{entry.category ?? <span className="mx-muted">—</span>}</td>
                <td>{entry.eventTitle ?? <span className="mx-muted">—</span>}</td>
                <td className="num"><Signed entry={entry} /></td>
                <td>{entry.recordedByName ?? <span className="mx-muted">—</span>}</td>
                <td className="mx-mono">{entry.reference ?? <span className="mx-muted" style={{ fontFamily: "inherit" }}>—</span>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={source !== null} title={source?.data?.title ?? source?.entry.description ?? "Source"} description={source ? `${titleCase(source.entry.sourceType)} · ${dateTime(source.entry.occurredAt)}` : undefined} onClose={() => setSource(null)}>
        {source?.loading ? <Loading label="Loading source record…" /> : null}
        {source?.error ? <Alert tone="error">{source.error}</Alert> : null}
        {source?.notFound ? <Alert tone="info">No source record. Opening balances and historical imports have no linked transaction.</Alert> : null}
        {source?.data ? (
          <div className="mx-stack">
            <KeyValue items={[
              { label: "Amount", value: <Signed entry={source.entry} /> },
              ...source.data.details.map((d) => ({ label: d.label, value: d.value })),
            ]} />
            {source.data.receiptId ? <a className="mx-btn" href={`/api/receipts/${encodeURIComponent(source.data.receiptId)}`} target="_blank" rel="noopener noreferrer"><Icon.receipt />Open receipt</a> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
