"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EventDetails, EventReport, Ticket, TicketStatus, WorkspaceEventReport } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { useT } from "../../../_lib/i18n";
import { Alert, Button, Card, Countdown, EmptyState, ErrorState, FormPanel, KeyValue, LinkButton, PageHead, Person, PreviewNote, Skeleton, Stat, StatusBadge, Tabs, When } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { QrCode, ticketQrValue } from "../../../_components/qr";

type FullReport = EventReport & WorkspaceEventReport;
type DeskTab = "holds" | "tickets";
const LIVE: TicketStatus[] = ["pending_payment", "paid"];

/** Rupee amount, or the translated "Free" for zero (prices and tickets). */
function usePrice() {
  const { t, fmt } = useT();
  return (paise: number) => (paise === 0 ? t("state.free") : fmt.currency(paise));
}

function BookingCard({ event, reloadMine }: { event: EventDetails; reloadMine: () => Promise<void> }) {
  const { t, apiError } = useT();
  const price$ = usePrice();
  const { pass, can } = useSession();
  const action = useAction();
  const price = pass?.membership === "active" ? event.memberPricePaise : event.guestPricePaise;
  const open = event.status === "published" && new Date(event.startsAt).getTime() > Date.now();
  if (!can("bookings:create")) return null;
  return (
    <Card kicker={t("events.detail.yourSeat")} title={t("events.detail.bookTitle")}>
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <KeyValue items={[
        { label: t("events.detail.yourPrice"), value: <>{price$(price)} <span className="mx-muted">({pass?.membership === "active" ? t("events.detail.memberRate") : t("events.detail.guestRate")})</span></> },
        { label: t("events.detail.seatsLeft"), value: t("events.detail.seatsOf", { available: event.available, capacity: event.capacity }) },
      ]} />
      <p className="mx-muted mx-small" style={{ margin: "14px 0" }}>{price === 0 ? t("events.detail.freeInstant") : t("events.detail.holdInfo")}</p>
      <Button variant="primary" loading={action.busy === "book"} disabled={!open || event.available === 0} onClick={() => void action.run("book", async () => {
        try {
          await api.post<{ ticket: Ticket }>(`/api/events/${encodeURIComponent(event.id)}/tickets`);
        } catch (caught) {
          throw new Error(apiError(caught));
        }
        await reloadMine();
      })}>
        <Icon name="ticket" size={18} />{!open ? t("events.detail.bookingsClosed") : event.available === 0 ? t("events.card.soldOut") : t("events.detail.bookMySeat")}
      </Button>
    </Card>
  );
}

function MyTicketCard({ ticket, event, reload }: { ticket: Ticket; event: EventDetails; reload: () => Promise<void> }) {
  const { t, apiError } = useT();
  const price$ = usePrice();
  const action = useAction();
  const pricing = ticket.pricing === "member" ? t("pricing.member") : t("pricing.guest");
  return (
    <Card kicker={t("events.detail.yourSeat")} title={t("events.detail.yourTicket")} actions={<StatusBadge status={ticket.status} />}>
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <div className="mx-row" style={{ alignItems: "flex-start", gap: 20 }}>
        {ticket.qrToken ? <QrCode value={ticketQrValue(ticket.qrToken)} alt={t("events.detail.qrAlt", { title: event.title, code: ticket.shortCode })} size={160} /> : null}
        <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
          <div><div className="eyebrow">{t("events.detail.doorCode")}</div><p className="mx-code-big">{ticket.shortCode}</p></div>
          <KeyValue items={[
            { label: t("col.holder"), value: ticket.holderName },
            { label: t("col.price"), value: <>{price$(ticket.pricePaise)} <span className="mx-muted">({pricing})</span></> },
            ...(ticket.status === "pending_payment" ? [{ label: t("time.holdExpires"), value: <Countdown until={ticket.holdExpiresAt} onExpire={() => void reload()} /> }] : []),
            ...(ticket.paidAt ? [{ label: t("events.detail.paid"), value: <When iso={ticket.paidAt} /> }] : []),
            ...(ticket.checkedInAt ? [{ label: t("events.detail.checkedIn"), value: <When iso={ticket.checkedInAt} /> }] : []),
          ]} />
          {ticket.status === "pending_payment" ? (
            <>
              <p className="mx-muted mx-small">{t("events.detail.showCode")}</p>
              <div><button type="button" className="button-small red-btn" disabled={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => {
                try { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); } catch (caught) { throw new Error(apiError(caught)); }
                await reload();
              })}>{action.busy === "cancel" ? t("events.detail.cancelling") : t("events.detail.cancelHold")}</button></div>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function GuestBookingCard({ event }: { event: EventDetails }) {
  const { t, apiError } = useT();
  const price$ = usePrice();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ticket: Ticket; url: string } | null>(null);
  const action = useAction();
  const open = event.status === "published" && new Date(event.startsAt).getTime() > Date.now();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await action.run("guest", async () => {
      let created: { ticket: Ticket; url: string };
      try {
        created = await api.post<{ ticket: Ticket; url: string }>(`/api/events/${encodeURIComponent(event.id)}/guest-tickets`, { name: name.trim(), email: email.trim() });
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      setResult(created);
      setName("");
      setEmail("");
    });
  }

  return (
    <FormPanel title={t("events.guest.title")} description={t("events.guest.description", { price: price$(event.guestPricePaise) })}>
      {result ? (
        <Alert tone="success" onDismiss={() => setResult(null)}>
          {t("events.guest.created", { name: result.ticket.holderName, code: result.ticket.shortCode })}{" "}
          <a className="mx-link" href={result.url} target="_blank" rel="noreferrer">{t("events.guest.openTicket")} <Icon name="external" size={12} /></a>
          {result.ticket.status === "pending_payment" ? ` ${t("events.guest.paymentAtDesk")}` : null}
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <div className="task-form-grid">
          <label>{t("events.guest.name")}<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} disabled={action.busy === "guest"} /></label>
          <label>{t("events.guest.email")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} disabled={action.busy === "guest"} /></label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "guest"} disabled={!open || event.available === 0}>{!open ? t("events.detail.bookingsClosed") : event.available === 0 ? t("events.card.soldOut") : t("events.guest.submit")}</Button>
        </div>
        {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
      </form>
    </FormPanel>
  );
}

function HoldRow({ ticket, onDone }: { ticket: Ticket; onDone: () => Promise<void> }) {
  const { t, apiError } = useT();
  const price$ = usePrice();
  const [reference, setReference] = useState("");
  const action = useAction();
  const pricing = ticket.pricing === "member" ? t("pricing.member") : t("pricing.guest");
  return (
    <tr>
      <td><Person name={ticket.holderName} sub={ticket.memberId ? t("events.desk.member") : t("events.desk.guestWith", { email: ticket.guestEmail ?? "" })} /></td>
      <td><span className="payment-ref">{ticket.shortCode}</span></td>
      <td className="amount-cell"><strong>{price$(ticket.pricePaise)}</strong><span className="subtext">{pricing}</span></td>
      <td><Countdown until={ticket.holdExpiresAt} onExpire={() => void onDone()} /></td>
      <td>
        <div className="expense-action-row">
          <input className="mx-input sm" placeholder={t("events.desk.referencePlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: 170 }} aria-label={t("events.desk.referenceFor", { name: ticket.holderName })} />
          <button type="button" className="button-small green-btn" disabled={reference.trim().length < 3 || action.busy === "confirm"} onClick={() => void action.run("confirm", async () => {
            try {
              await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/confirm`, { reference: reference.trim() });
            } catch (caught) {
              if (caught instanceof ApiError && caught.code === "hold_expired") { await onDone(); }
              throw new Error(apiError(caught));
            }
            await onDone();
          })}>{action.busy === "confirm" ? t("state.saving") : t("action.confirm")}</button>
          <button type="button" className="button-small red-btn" disabled={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => {
            try { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); } catch (caught) { throw new Error(apiError(caught)); }
            await onDone();
          })}>{t("action.cancel")}</button>
        </div>
        {action.error ? <span className="rejection-note" role="alert">{action.error}</span> : null}
      </td>
    </tr>
  );
}

function Desk({ eventId, version, onChange }: { eventId: string; version: number; onChange: () => void }) {
  const { t } = useT();
  const price$ = usePrice();
  const [tab, setTab] = useState<DeskTab>("holds");
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const holds = useLoad(() => api.get<{ holds: Ticket[] }>(`/api/events/${encodeURIComponent(eventId)}/holds`), [eventId, version]);
  const tickets = useLoad(() => api.get<{ tickets: Ticket[] }>(`/api/events/${encodeURIComponent(eventId)}/tickets`), [eventId, version]);
  /** Bumping the shared version re-runs the holds, tickets, report and seat-count loaders together. */
  const refresh = useCallback(async () => { onChange(); }, [onChange]);

  const holdList = holds.data?.holds ?? [];
  const ticketList = (tickets.data?.tickets ?? []).filter((ticket) => filter === "all" || ticket.status === filter);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div><div className="eyebrow">{t("events.desk.eyebrow")}</div><h2>{t("events.desk.title")}</h2></div>
        <button type="button" className="text-button" onClick={() => void refresh()}>{t("action.refresh")}<Icon name="refresh" size={14} /></button>
      </div>
      <div style={{ padding: "0 25px" }}>
        <Tabs value={tab} onChange={setTab} items={[{ value: "holds", label: t("events.desk.tabHolds"), count: holdList.length }, { value: "tickets", label: t("events.desk.tabTickets"), count: tickets.data?.tickets.length }]} />
      </div>
      {tab === "holds" ? (
        holds.error ? <div className="panel-body"><ErrorState error={holds.error} onRetry={holds.reload} /></div> : holds.loading && !holds.data ? <div className="panel-body"><Skeleton /></div> : !holdList.length ? <EmptyState title={t("events.desk.noHolds")} icon="ticket">{t("events.desk.noHoldsBody")}</EmptyState> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th scope="col">{t("col.holder")}</th><th scope="col">{t("col.code")}</th><th scope="col" className="amount-cell">{t("events.desk.colDue")}</th><th scope="col">{t("events.desk.colHoldLeft")}</th><th scope="col">{t("events.desk.colConfirm")}</th></tr></thead>
              <tbody>{holdList.map((ticket) => <HoldRow key={ticket.id} ticket={ticket} onDone={refresh} />)}</tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="task-filters" style={{ padding: "0 25px 16px" }}>
            <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value as TicketStatus | "all")} aria-label={t("events.desk.filterLabel")}>
              <option value="all">{t("events.desk.allStatuses")}</option>
              <option value="pending_payment">{t("status.pending_payment")}</option>
              <option value="paid">{t("status.paid")}</option>
              <option value="cancelled">{t("status.cancelled")}</option>
              <option value="expired">{t("status.expired")}</option>
            </select>
          </div>
          {tickets.error ? <div className="panel-body"><ErrorState error={tickets.error} onRetry={tickets.reload} /></div> : tickets.loading && !tickets.data ? <div className="panel-body"><Skeleton /></div> : !ticketList.length ? <EmptyState title={t("events.desk.noTickets")} icon="ticket">{t("events.desk.noTicketsBody")}</EmptyState> : (
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">{t("col.holder")}</th><th scope="col">{t("col.code")}</th><th scope="col">{t("col.status")}</th><th scope="col" className="amount-cell">{t("col.price")}</th><th scope="col">{t("events.desk.colPaid")}</th><th scope="col">{t("events.desk.colCheckedIn")}</th></tr></thead>
                <tbody>
                  {ticketList.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><Person name={ticket.holderName} sub={ticket.memberId ? t("events.desk.member") : t("events.desk.guestWith", { email: ticket.guestEmail ?? "" })} /></td>
                      <td><span className="payment-ref">{ticket.shortCode}</span></td>
                      <td><StatusBadge status={ticket.status} /></td>
                      <td className="amount-cell">{price$(ticket.pricePaise)}</td>
                      <td>{ticket.paidAt ? <><When iso={ticket.paidAt} />{ticket.paymentReference ? <span className="payment-ref">{t("events.desk.ref", { reference: ticket.paymentReference })}</span> : null}</> : "—"}</td>
                      <td>{ticket.checkedInAt ? <When iso={ticket.checkedInAt} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Report({ eventId, version }: { eventId: string; version: number }) {
  const { t, fmt } = useT();
  const report = useLoad(() => api.get<FullReport>(`/api/events/${encodeURIComponent(eventId)}/report`), [eventId, version]);
  const r = report.data;
  return (
    <Card kicker={t("events.report.eyebrow")} title={t("events.report.title")} actions={<button type="button" className="text-button" onClick={() => void report.reload()}>{t("action.refresh")}<Icon name="refresh" size={14} /></button>}>
      {report.error ? <ErrorState error={report.error} onRetry={report.reload} /> : !r ? <Skeleton /> : (
        <>
          <div className="metrics-grid" style={{ marginBottom: 0, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Stat label={t("events.report.sold")} value={String(r.ticketsSold).padStart(2, "0")} hint={t("events.report.soldHint", { pending: r.tickets.pendingPayment, cancelled: r.tickets.cancelled, expired: r.tickets.expired })} tone="blue" icon="ticket" />
            <Stat label={t("events.report.attendance")} value={String(r.attendance).padStart(2, "0")} hint={t("events.report.attendanceHint")} tone="green" icon="door" />
            <Stat label={t("events.report.pending")} value={String(r.tickets.pendingPayment).padStart(2, "0")} hint={t("events.report.pendingHint")} tone="accent" icon="clock" />
            <Stat label={t("events.report.revenue")} value={fmt.currency(r.realizedRevenuePaise)} hint={t("events.report.revenueHint")} tone="dark" icon="wallet" />
          </div>
          <div className="event-report" aria-label={t("events.report.aria", { title: r.eventTitle })}>
            <div className="event-report-heading">
              <span className="eyebrow">{t("events.report.fundraiser")}</span>
              <span className={`badge ${r.fundraiser.onTrack ? "green" : "amber"}`}>{r.fundraiser.onTrack ? t("events.report.onTrack") : t("events.report.needsAttention")}</span>
            </div>
            <div className="report-progress-label">
              <span>{r.fundraiser.goalPaise > 0
                ? t("events.report.progressRemaining", { raised: fmt.currency(r.fundraiser.raisedPaise), goal: fmt.currency(r.fundraiser.goalPaise), remaining: fmt.currency(r.fundraiser.remainingPaise) })
                : t("events.report.progress", { raised: fmt.currency(r.fundraiser.raisedPaise), goal: fmt.currency(r.fundraiser.goalPaise) })}</span>
              <strong>{r.fundraiser.percent}%</strong>
            </div>
            <div className="capacity-bar report-bar"><span style={{ width: `${Math.min(100, Math.max(0, r.fundraiser.percent))}%` }} /></div>
            <div className="report-task-summary">
              <span>{t("events.report.tasks", { count: r.tasks.total })}</span>
              <span>{t("events.report.done", { count: r.tasks.done })}</span>
              <span>{t("events.report.inProgress", { count: r.tasks.inProgress })}</span>
              <span className={r.tasks.overdue > 0 ? "overdue-text" : ""}>{t("events.report.overdue", { count: r.tasks.overdue })}</span>
            </div>
            <div className="mx-mt"><Link href={`/app/tasks?eventId=${encodeURIComponent(eventId)}`} className="text-button">{t("events.report.openTasks")}<Icon name="arrow" size={16} /></Link></div>
          </div>
        </>
      )}
    </Card>
  );
}

export default function EventDetailPage() {
  const { t, fmt, apiError } = useT();
  const price$ = usePrice();
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id, version]);
  const mine = useLoad(() => (can("bookings:create") ? api.get<{ tickets: Ticket[] }>("/api/tickets/mine") : Promise.resolve({ tickets: [] })), [id]);

  const e = event.data?.event;
  if (event.error) {
    const notFound = event.error instanceof ApiError && event.error.status === 404;
    return (
      <section className="panel">
        <EmptyState title={notFound ? t("events.detail.notFound") : t("events.detail.loadFailed")} icon="calendar" action={<LinkButton href="/app/events">{t("events.new.backToEvents")}</LinkButton>}>{notFound ? t("events.detail.notFoundBody") : apiError(event.error)}</EmptyState>
      </section>
    );
  }
  if (!e) return <section className="panel task-create-panel"><Skeleton rows={8} /></section>;

  const myTicket = (mine.data?.tickets ?? []).find((ticket) => ticket.eventId === e.id && LIVE.includes(ticket.status));
  const reloadMine = async () => { await Promise.all([mine.reload(), event.reload()]); };

  return (
    <>
      <PageHead
        eyebrow={<><Link href="/app/events">{t("events.eyebrow")}</Link> <span>/</span> {e.title.toUpperCase()}</>}
        title={e.title}
        description={<>{fmt.dateTime(e.startsAt)} · {e.venue} · <strong>{e.available}</strong> {t("events.detail.ofSeatsLeft", { capacity: e.capacity })}</>}
        actions={<>
          {e.status !== "published" ? <StatusBadge status={e.status} /> : null}
          {can("tickets:check_in") ? <Link href={`/app/events/${e.id}/door`} className="button primary"><Icon name="scan" size={18} />{t("events.detail.doorScanner")}</Link> : null}
          {can("events:write") ? <Link href={`/app/events/${e.id}/edit`} className="button secondary"><Icon name="edit" size={16} />{t("action.edit")}</Link> : null}
        </>}
      />
      {e.status === "cancelled" ? <div className="error-inline" role="status"><span>{t("events.detail.cancelledNotice")}</span></div> : e.status === "draft" ? <div className="outstanding-notice"><div className="mx-row" style={{ flexWrap: "nowrap" }}><Icon name="eye" size={16} /><div><strong>{t("events.detail.draft")}</strong><p>{t("events.detail.draftBody")}</p></div></div></div> : null}

      <div className="overview-grid">
        <div className="mx-stack">
          {e.description ? <Card kicker={t("events.detail.about")} title={t("events.detail.whatToExpect")}><p className="mx-prose">{e.description}</p></Card> : null}
          {can("payments:confirm") ? <Desk eventId={e.id} version={version} onChange={bump} /> : null}
          {can("events:report") ? <Report eventId={e.id} version={version} /> : null}
          <GuestBookingCard event={e} />
        </div>
        <div className="mx-stack">
          {mine.loading && !mine.data ? <Card><Skeleton rows={3} /></Card> : myTicket ? <MyTicketCard ticket={myTicket} event={e} reload={reloadMine} /> : <BookingCard event={e} reloadMine={reloadMine} />}
          <Card kicker={t("events.detail.ticketsKicker")} title={t("events.detail.pricing")}>
            <KeyValue items={[
              { label: t("events.detail.membersActive"), value: price$(e.memberPricePaise) },
              { label: t("events.detail.guestsExpired"), value: price$(e.guestPricePaise) },
              { label: t("col.capacity"), value: t("events.detail.seats", { count: e.capacity }) },
              { label: t("col.status"), value: <StatusBadge status={e.status} /> },
            ]} />
          </Card>
        </div>
      </div>
      <PreviewNote>{t("events.detail.note")}</PreviewNote>
    </>
  );
}
