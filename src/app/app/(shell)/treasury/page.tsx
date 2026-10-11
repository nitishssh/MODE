"use client";

import { useMemo, useState } from "react";
import type { ExpenseLedgerEntry, LedgerSource, LedgerSummary } from "@/lib/contracts";
import { api, ApiError, describeError, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { amount, date, dateTime, titleCase } from "../../_lib/format";
import { Alert, Card, EmptyState, ErrorState, KeyValue, Loading, Modal, PageHead, PreviewNote, Stat, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's Treasury: metric cards, pill tabs, overview breakdowns, the ledger
 * register with search and filters, CSV export, and a source drill-down. */

type Tab = "overview" | "register" | "export";
type KindFilter = "all" | "income" | "expense";

function Signed({ entry }: { entry: ExpenseLedgerEntry }) {
  const income = entry.kind === "income";
  return <span className={income ? "positive" : undefined}>{income ? "+" : "−"}{amount(entry.amountPaise)}</span>;
}

export default function TreasuryPage() {
  const { can } = useSession();
  const allowed = can("ledger:read");

  const summary = useLoad(() => (allowed ? api.get<LedgerSummary>("/api/ledger/summary") : Promise.resolve(null)), [allowed]);
  const entries = useLoad(() => (allowed ? api.get<ExpenseLedgerEntry[]>("/api/ledger/entries") : Promise.resolve([] as ExpenseLedgerEntry[])), [allowed]);

  const [tab, setTab] = useState<Tab>("overview");
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
        <PageHead eyebrow={<>CLUB <span>/</span> TREASURY</>} title="Treasury" />
        <section className="panel"><EmptyState title="Treasurer access only" icon="wallet">The ledger, summary and export are visible to treasurers and the club lead.</EmptyState></section>
      </>
    );
  }

  const s = summary.data;

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> TREASURY</>}
        title="Treasury"
        description="One ledger for dues, tickets, merchandise and reimbursements. Balances are computed on the server."
      />

      {summary.error ? <ErrorState error={summary.error} onRetry={summary.reload} title="The summary could not load" /> : null}

      <section className="metrics-grid treasury-metrics" aria-label="Treasury summary">
        <Stat label="Club balance" value={s ? amount(s.balancePaise) : "—"} hint="Recorded income minus expenses" tone="dark" icon="wallet" />
        <Stat label="Inflow" value={s ? amount(s.inflowPaise) : "—"} hint="Dues, tickets, orders" tone="green" icon="coin" />
        <Stat label="Outflow" value={s ? amount(s.outflowPaise) : "—"} hint="Reimbursements paid" tone="accent" icon="receipt" />
        <Stat label="Approved, unpaid" value={s ? amount(s.approvedUnpaidPaise) : "—"} hint="Committed but not yet paid out" tone="amber" icon="clock" />
      </section>

      <Tabs value={tab} onChange={setTab} items={[{ value: "overview", label: "Overview" }, { value: "register", label: "Register", count: list.length }, { value: "export", label: "Export" }]} />

      {tab === "overview" ? (
        <div>
          {s && s.approvedUnpaidPaise > 0 ? (
            <div className="outstanding-notice">
              <Icon name="alert" size={16} />
              <div><strong>Outstanding liabilities</strong><p>{amount(s.approvedUnpaidPaise)} in approved claims is still to be paid out.</p></div>
            </div>
          ) : null}
          <div className="treasury-overview-grid">
            <Card kicker="WHERE THE MONEY MOVES" title="By category" flush>
              {summary.loading && !s ? <Loading label="Loading…" /> : !s?.byCategory.length ? <EmptyState title="No entries yet" icon="wallet">Income and expenses will be grouped here.</EmptyState> : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">Category</th><th scope="col" className="amount-cell">Inflow</th><th scope="col" className="amount-cell">Outflow</th><th scope="col" className="amount-cell">Net</th></tr></thead>
                    <tbody>
                      {s.byCategory.map((cat) => (
                        <tr key={cat.category}>
                          <td><strong>{titleCase(cat.category)}</strong></td>
                          <td className="amount-cell positive">+{amount(cat.inflowPaise)}</td>
                          <td className="amount-cell">{cat.outflowPaise > 0 ? `−${amount(cat.outflowPaise)}` : "—"}</td>
                          <td className={`amount-cell ${cat.inflowPaise - cat.outflowPaise >= 0 ? "positive" : ""}`.trim()}>{amount(cat.inflowPaise - cat.outflowPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card kicker="BY EVENT" title="Event breakdown" flush>
              {summary.loading && !s ? <Loading label="Loading…" /> : !s?.byEvent.length ? <EmptyState title="No event money yet" icon="calendar">Ticket income and event expenses will appear here.</EmptyState> : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">Event</th><th scope="col" className="amount-cell">Inflow</th><th scope="col" className="amount-cell">Outflow</th></tr></thead>
                    <tbody>
                      {s.byEvent.map((ev) => (
                        <tr key={ev.eventId}>
                          <td><strong>{ev.eventTitle}</strong></td>
                          <td className="amount-cell positive">+{amount(ev.inflowPaise)}</td>
                          <td className="amount-cell">{ev.outflowPaise > 0 ? `−${amount(ev.outflowPaise)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "register" ? (
        <div>
          <div className="ledger-actions" style={{ marginBottom: 20 }}>
            <input className="ledger-search" type="search" placeholder="Search description, reference, officer…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search entries" />
            <select className="filter-select" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} aria-label="Filter by kind">
              <option value="all">Income and expense</option>
              <option value="income">Income only</option>
              <option value="expense">Expense only</option>
            </select>
            <select className="filter-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event">
              <option value="">All events</option>
              {eventOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
            <a className="button secondary" href="/api/ledger/export.csv" download><Icon name="download" size={16} />Export CSV</a>
          </div>
          <Card kicker="LEDGER" title="Register" flush actions={<span className="subtext" style={{ margin: 0 }}>{rows.length} of {list.length} entries</span>}>
            {entries.error ? <ErrorState error={entries.error} onRetry={entries.reload} /> : entries.loading && !entries.data ? <Loading label="Loading entries…" /> : !rows.length ? (
              <EmptyState title="No entries" icon="wallet">{list.length ? "Nothing matches these filters." : "The ledger is empty."}</EmptyState>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">Date</th><th scope="col">Kind</th><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Event</th><th scope="col" className="amount-cell">Amount</th><th scope="col">Recorded by</th><th scope="col">Reference</th></tr></thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr key={entry.id} onClick={() => void openSource(entry)} title="Show source record" style={{ cursor: "pointer" }}>
                        <td>{date(entry.occurredAt)}</td>
                        <td><span className={`badge ${entry.kind === "income" ? "green" : "red"}`}>{entry.kind === "income" ? "Income" : "Expense"}</span></td>
                        <td><strong>{entry.description}</strong><span className="subtext">{titleCase(entry.sourceType)}</span></td>
                        <td>{entry.category ? titleCase(entry.category) : "—"}</td>
                        <td>{entry.eventTitle ?? "—"}</td>
                        <td className="amount-cell"><Signed entry={entry} /></td>
                        <td>{entry.recordedByName ?? "—"}</td>
                        <td>{entry.reference ? <span className="payment-ref">{entry.reference}</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "export" ? (
        <Card kicker="TAKE IT WITH YOU" title="Export the ledger">
          <p className="mx-muted mx-small" style={{ marginBottom: 16, lineHeight: 1.7 }}>Download the canonical seven-column register as CSV: date, kind, amount, source type, source id, description, recorded by. Amounts are positive rupees; kind supplies the direction, so summing income and expense rows reproduces the balance above.</p>
          <div className="ledger-actions">
            <a className="button primary" href="/api/ledger/export.csv" download><Icon name="download" size={16} />Export CSV</a>
            <a className="button secondary" href="/api/ledger/export" download>Legacy export</a>
          </div>
        </Card>
      ) : null}

      <PreviewNote>Every entry links back to its source: a dues payment, ticket, merchandise order or paid expense. Opening balances were recorded before MODE and have no source record.</PreviewNote>

      <Modal open={source !== null} title={source?.data?.title ?? source?.entry.description ?? "Source"} description={source ? `${titleCase(source.entry.sourceType)} · ${dateTime(source.entry.occurredAt)}` : undefined} onClose={() => setSource(null)}>
        {source?.loading ? <Loading label="Loading source record…" /> : null}
        {source?.error ? <Alert tone="error">{source.error}</Alert> : null}
        {source?.notFound ? <Alert tone="info">No source record. Opening balances and historical imports have no linked transaction.</Alert> : null}
        {source?.data ? (
          <div className="mx-stack-sm">
            <KeyValue items={[
              { label: "Amount", value: <Signed entry={source.entry} /> },
              ...source.data.details.map((d) => ({ label: d.label, value: d.value })),
            ]} />
            {source.data.receiptId ? <div className="form-actions"><a className="button secondary" href={`/api/receipts/${encodeURIComponent(source.data.receiptId)}`} target="_blank" rel="noopener noreferrer"><Icon name="receipt" size={16} />Open receipt</a></div> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
