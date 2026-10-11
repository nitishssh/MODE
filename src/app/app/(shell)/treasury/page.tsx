"use client";

import { useMemo, useState } from "react";
import type { ExpenseLedgerEntry, LedgerSource, LedgerSummary } from "@/lib/contracts";
import { api, ApiError, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { useT } from "../../_lib/i18n";
import { titleCase } from "../../_lib/format";
import { Alert, Card, EmptyState, ErrorState, KeyValue, Loading, Modal, PageHead, PreviewNote, Stat, Tabs } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's Treasury: metric cards, pill tabs, overview breakdowns, the ledger
 * register with search and filters, CSV export, and a source drill-down. */

type Tab = "overview" | "register" | "export";
type KindFilter = "all" | "income" | "expense";

function Signed({ entry }: { entry: ExpenseLedgerEntry }) {
  const { fmt } = useT();
  const income = entry.kind === "income";
  return <span className={income ? "positive" : undefined}>{income ? "+" : "−"}{fmt.currency(entry.amountPaise)}</span>;
}

export default function TreasuryPage() {
  const { can } = useSession();
  const { t, fmt, apiError } = useT();
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
      else setSource({ entry, loading: false, data: null, error: apiError(caught), notFound: false });
    }
  }

  const eyebrow = <>{t("treasury.eyebrowClub")} <span>/</span> {t("treasury.eyebrow")}</>;

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("treasury.title")} />
        <section className="panel"><EmptyState title={t("treasury.onlyTitle")} icon="wallet">{t("treasury.onlyBody")}</EmptyState></section>
      </>
    );
  }

  const s = summary.data;

  return (
    <>
      <PageHead eyebrow={eyebrow} title={t("treasury.title")} description={t("treasury.description")} />

      {summary.error ? <ErrorState error={summary.error} onRetry={summary.reload} title={t("treasury.summaryErrorTitle")} /> : null}

      <section className="metrics-grid treasury-metrics" aria-label={t("treasury.summary.ariaLabel")}>
        <Stat label={t("treasury.summary.balance")} value={s ? fmt.currency(s.balancePaise) : "—"} hint={t("treasury.summary.balanceHint")} tone="dark" icon="wallet" />
        <Stat label={t("treasury.summary.inflow")} value={s ? fmt.currency(s.inflowPaise) : "—"} hint={t("treasury.summary.inflowHint")} tone="green" icon="coin" />
        <Stat label={t("treasury.summary.outflow")} value={s ? fmt.currency(s.outflowPaise) : "—"} hint={t("treasury.summary.outflowHint")} tone="accent" icon="receipt" />
        <Stat label={t("treasury.summary.approvedUnpaid")} value={s ? fmt.currency(s.approvedUnpaidPaise) : "—"} hint={t("treasury.summary.approvedUnpaidHint")} tone="amber" icon="clock" />
      </section>

      <Tabs value={tab} onChange={setTab} items={[{ value: "overview", label: t("treasury.tab.overview") }, { value: "register", label: t("treasury.tab.register"), count: list.length }, { value: "export", label: t("treasury.tab.export") }]} />

      {tab === "overview" ? (
        <div>
          {s && s.approvedUnpaidPaise > 0 ? (
            <div className="outstanding-notice">
              <Icon name="alert" size={16} />
              <div><strong>{t("treasury.liabilities.title")}</strong><p>{t("treasury.liabilities.body", { amount: fmt.currency(s.approvedUnpaidPaise) })}</p></div>
            </div>
          ) : null}
          <div className="treasury-overview-grid">
            <Card kicker={t("treasury.byCategory.kicker")} title={t("treasury.byCategory.title")} flush>
              {summary.loading && !s ? <Loading label={t("state.loading")} /> : !s?.byCategory.length ? <EmptyState title={t("treasury.byCategory.emptyTitle")} icon="wallet">{t("treasury.byCategory.emptyBody")}</EmptyState> : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">{t("col.category")}</th><th scope="col" className="amount-cell">{t("treasury.col.inflow")}</th><th scope="col" className="amount-cell">{t("treasury.col.outflow")}</th><th scope="col" className="amount-cell">{t("treasury.col.net")}</th></tr></thead>
                    <tbody>
                      {s.byCategory.map((cat) => (
                        <tr key={cat.category}>
                          <td><strong>{titleCase(cat.category)}</strong></td>
                          <td className="amount-cell positive">+{fmt.currency(cat.inflowPaise)}</td>
                          <td className="amount-cell">{cat.outflowPaise > 0 ? `−${fmt.currency(cat.outflowPaise)}` : "—"}</td>
                          <td className={`amount-cell ${cat.inflowPaise - cat.outflowPaise >= 0 ? "positive" : ""}`.trim()}>{fmt.currency(cat.inflowPaise - cat.outflowPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card kicker={t("treasury.byEvent.kicker")} title={t("treasury.byEvent.title")} flush>
              {summary.loading && !s ? <Loading label={t("state.loading")} /> : !s?.byEvent.length ? <EmptyState title={t("treasury.byEvent.emptyTitle")} icon="calendar">{t("treasury.byEvent.emptyBody")}</EmptyState> : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">{t("col.event")}</th><th scope="col" className="amount-cell">{t("treasury.col.inflow")}</th><th scope="col" className="amount-cell">{t("treasury.col.outflow")}</th></tr></thead>
                    <tbody>
                      {s.byEvent.map((ev) => (
                        <tr key={ev.eventId}>
                          <td><strong>{ev.eventTitle}</strong></td>
                          <td className="amount-cell positive">+{fmt.currency(ev.inflowPaise)}</td>
                          <td className="amount-cell">{ev.outflowPaise > 0 ? `−${fmt.currency(ev.outflowPaise)}` : "—"}</td>
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
            <input className="ledger-search" type="search" placeholder={t("treasury.register.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("treasury.register.searchAria")} />
            <select className="filter-select" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} aria-label={t("treasury.register.filterKind")}>
              <option value="all">{t("treasury.register.kindAll")}</option>
              <option value="income">{t("treasury.register.kindIncome")}</option>
              <option value="expense">{t("treasury.register.kindExpense")}</option>
            </select>
            <select className="filter-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label={t("treasury.register.filterEvent")}>
              <option value="">{t("treasury.register.allEvents")}</option>
              {eventOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
            <a className="button secondary" href="/api/ledger/export.csv" download><Icon name="download" size={16} />{t("treasury.register.exportCsv")}</a>
          </div>
          <Card kicker={t("treasury.register.kicker")} title={t("treasury.register.title")} flush actions={<span className="subtext" style={{ margin: 0 }}>{t("treasury.register.count", { count: rows.length, total: list.length })}</span>}>
            {entries.error ? <ErrorState error={entries.error} onRetry={entries.reload} /> : entries.loading && !entries.data ? <Loading label={t("treasury.register.loading")} /> : !rows.length ? (
              <EmptyState title={t("treasury.register.emptyTitle")} icon="wallet">{list.length ? t("treasury.register.emptyFiltered") : t("treasury.register.emptyLedger")}</EmptyState>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">{t("col.date")}</th><th scope="col">{t("treasury.col.kind")}</th><th scope="col">{t("col.description")}</th><th scope="col">{t("col.category")}</th><th scope="col">{t("col.event")}</th><th scope="col" className="amount-cell">{t("col.amount")}</th><th scope="col">{t("col.recordedBy")}</th><th scope="col">{t("col.reference")}</th></tr></thead>
                  <tbody>
                    {rows.map((entry) => (
                      <tr key={entry.id} onClick={() => void openSource(entry)} title={t("treasury.register.showSource")} style={{ cursor: "pointer" }}>
                        <td>{fmt.date(entry.occurredAt)}</td>
                        <td><span className={`badge ${entry.kind === "income" ? "green" : "red"}`}>{entry.kind === "income" ? t("status.income") : t("status.expense")}</span></td>
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
        <Card kicker={t("treasury.export.kicker")} title={t("treasury.export.title")}>
          <p className="mx-muted mx-small" style={{ marginBottom: 16, lineHeight: 1.7 }}>{t("treasury.export.body")}</p>
          <div className="ledger-actions">
            <a className="button primary" href="/api/ledger/export.csv" download><Icon name="download" size={16} />{t("treasury.register.exportCsv")}</a>
            <a className="button secondary" href="/api/ledger/export" download>{t("treasury.export.legacy")}</a>
          </div>
        </Card>
      ) : null}

      <PreviewNote>{t("treasury.note")}</PreviewNote>

      <Modal open={source !== null} title={source?.data?.title ?? source?.entry.description ?? t("treasury.source.title")} description={source ? `${titleCase(source.entry.sourceType)} · ${fmt.dateTime(source.entry.occurredAt)}` : undefined} onClose={() => setSource(null)}>
        {source?.loading ? <Loading label={t("treasury.source.loading")} /> : null}
        {source?.error ? <Alert tone="error">{source.error}</Alert> : null}
        {source?.notFound ? <Alert tone="info">{t("treasury.source.notFound")}</Alert> : null}
        {source?.data ? (
          <div className="mx-stack-sm">
            <KeyValue items={[
              { label: t("col.amount"), value: <Signed entry={source.entry} /> },
              ...source.data.details.map((d) => ({ label: d.label, value: d.value })),
            ]} />
            {source.data.receiptId ? <div className="form-actions"><a className="button secondary" href={`/api/receipts/${encodeURIComponent(source.data.receiptId)}`} target="_blank" rel="noopener noreferrer"><Icon name="receipt" size={16} />{t("treasury.source.openReceipt")}</a></div> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
