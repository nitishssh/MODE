"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EventDetails, EventReport, Ticket, TicketStatus, WorkspaceEventReport } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { amount, dateTime, money } from "../../../_lib/format";
import { Alert, Button, Card, Countdown, EmptyState, ErrorState, FormPanel, KeyValue, LinkButton, PageHead, Person, PreviewNote, Skeleton, Stat, StatusBadge, Tabs, When } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { QrCode } from "../../../_components/qr";

type FullReport = EventReport & WorkspaceEventReport;
type DeskTab = "holds" | "tickets";
const LIVE: TicketStatus[] = ["pending_payment", "paid"];

function BookingCard({ event, reloadMine }: { event: EventDetails; reloadMine: () => Promise<void> }) {
  const { pass, can } = useSession();
  const action = useAction();
  const price = pass?.membership === "active" ? event.memberPricePaise : event.guestPricePaise;
  const open = event.status === "published" && new Date(event.startsAt).getTime() > Date.now();
  if (!can("bookings:create")) return null;
  return (
    <Card kicker="YOUR SEAT" title="Book a seat">
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <KeyValue items={[
        { label: "Your price", value: <>{money(price)} <span className="mx-muted">({pass?.membership === "active" ? "member rate" : "guest rate"})</span></> },
        { label: "Seats left", value: `${event.available} of ${event.capacity}` },
      ]} />
      <p className="mx-muted mx-small" style={{ margin: "14px 0" }}>{price === 0 ? "Free tickets are confirmed instantly." : "Your seat is held for 30 minutes. Pay an officer at the desk to confirm it."}</p>
      <Button variant="primary" loading={action.busy === "book"} disabled={!open || event.available === 0} onClick={() => void action.run("book", async () => {
        await api.post<{ ticket: Ticket }>(`/api/events/${encodeURIComponent(event.id)}/tickets`);
        await reloadMine();
      })}>
        <Icon name="ticket" size={18} />{!open ? "Bookings closed" : event.available === 0 ? "Sold out" : "Book my seat"}
      </Button>
    </Card>
  );
}

function MyTicketCard({ ticket, event, reload }: { ticket: Ticket; event: EventDetails; reload: () => Promise<void> }) {
  const action = useAction();
  return (
    <Card kicker="YOUR SEAT" title="Your ticket" actions={<StatusBadge status={ticket.status} />}>
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      <div className="mx-row" style={{ alignItems: "flex-start", gap: 20 }}>
        {ticket.qrToken ? <QrCode value={ticket.qrToken} alt={`Ticket QR for ${event.title}. Typed code ${ticket.shortCode}`} size={160} /> : null}
        <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
          <div><div className="eyebrow">DOOR CODE</div><p className="mx-code-big">{ticket.shortCode}</p></div>
          <KeyValue items={[
            { label: "Holder", value: ticket.holderName },
            { label: "Price", value: <>{money(ticket.pricePaise)} <span className="mx-muted">({ticket.pricing})</span></> },
            ...(ticket.status === "pending_payment" ? [{ label: "Hold expires", value: <Countdown until={ticket.holdExpiresAt} onExpire={() => void reload()} /> }] : []),
            ...(ticket.paidAt ? [{ label: "Paid", value: <When iso={ticket.paidAt} /> }] : []),
            ...(ticket.checkedInAt ? [{ label: "Checked in", value: <When iso={ticket.checkedInAt} /> }] : []),
          ]} />
          {ticket.status === "pending_payment" ? (
            <>
              <p className="mx-muted mx-small">Show this code to an officer with your payment to confirm the seat.</p>
              <div><button type="button" className="button-small red-btn" disabled={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await reload(); })}>{action.busy === "cancel" ? "Cancelling…" : "Cancel hold"}</button></div>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function GuestBookingCard({ event }: { event: EventDetails }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ticket: Ticket; url: string } | null>(null);
  const action = useAction();
  const open = event.status === "published" && new Date(event.startsAt).getTime() > Date.now();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await action.run("guest", async () => {
      const created = await api.post<{ ticket: Ticket; url: string }>(`/api/events/${encodeURIComponent(event.id)}/guest-tickets`, { name: name.trim(), email: email.trim() });
      setResult(created);
      setName("");
      setEmail("");
    });
  }

  return (
    <FormPanel title="Guest booking" description={<>Book for someone who is not a club member at {money(event.guestPricePaise)}. They get a private ticket link to show at the door.</>}>
      {result ? (
        <Alert tone="success" onDismiss={() => setResult(null)}>
          Ticket for <strong>{result.ticket.holderName}</strong> created. Door code <code className="mx-mono">{result.ticket.shortCode}</code>.{" "}
          <a className="mx-link" href={result.url} target="_blank" rel="noreferrer">Open ticket page <Icon name="external" size={12} /></a>
          {result.ticket.status === "pending_payment" ? " Payment is confirmed at the desk within 30 minutes." : null}
        </Alert>
      ) : null}
      <form onSubmit={submit}>
        <div className="task-form-grid">
          <label>Guest name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} disabled={action.busy === "guest"} /></label>
          <label>Guest email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} disabled={action.busy === "guest"} /></label>
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={action.busy === "guest"} disabled={!open || event.available === 0}>{!open ? "Bookings closed" : event.available === 0 ? "Sold out" : "Book guest ticket"}</Button>
        </div>
        {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
      </form>
    </FormPanel>
  );
}

function HoldRow({ ticket, onDone }: { ticket: Ticket; onDone: () => Promise<void> }) {
  const [reference, setReference] = useState("");
  const action = useAction();
  return (
    <tr>
      <td><Person name={ticket.holderName} sub={ticket.memberId ? "Member" : `Guest · ${ticket.guestEmail ?? ""}`} /></td>
      <td><span className="payment-ref">{ticket.shortCode}</span></td>
      <td className="amount-cell"><strong>{money(ticket.pricePaise)}</strong><span className="subtext">{ticket.pricing}</span></td>
      <td><Countdown until={ticket.holdExpiresAt} onExpire={() => void onDone()} /></td>
      <td>
        <div className="expense-action-row">
          <input className="mx-input sm" placeholder="Payment reference" value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: 170 }} aria-label={`Payment reference for ${ticket.holderName}`} />
          <button type="button" className="button-small green-btn" disabled={reference.trim().length < 3 || action.busy === "confirm"} onClick={() => void action.run("confirm", async () => {
            try {
              await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/confirm`, { reference: reference.trim() });
            } catch (caught) {
              if (caught instanceof ApiError && caught.code === "hold_expired") { await onDone(); }
              throw caught;
            }
            await onDone();
          })}>{action.busy === "confirm" ? "Saving…" : "Confirm"}</button>
          <button type="button" className="button-small red-btn" disabled={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await onDone(); })}>Cancel</button>
        </div>
        {action.error ? <span className="rejection-note" role="alert">{action.error}</span> : null}
      </td>
    </tr>
  );
}

function Desk({ eventId, version, onChange }: { eventId: string; version: number; onChange: () => void }) {
  const [tab, setTab] = useState<DeskTab>("holds");
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const holds = useLoad(() => api.get<{ holds: Ticket[] }>(`/api/events/${encodeURIComponent(eventId)}/holds`), [eventId, version]);
  const tickets = useLoad(() => api.get<{ tickets: Ticket[] }>(`/api/events/${encodeURIComponent(eventId)}/tickets`), [eventId, version]);
  /** Bumping the shared version re-runs the holds, tickets, report and seat-count loaders together. */
  const refresh = useCallback(async () => { onChange(); }, [onChange]);

  const holdList = holds.data?.holds ?? [];
  const ticketList = (tickets.data?.tickets ?? []).filter((t) => filter === "all" || t.status === filter);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div><div className="eyebrow">OFFICER DESK</div><h2>Ticket desk</h2></div>
        <button type="button" className="text-button" onClick={() => void refresh()}>Refresh<Icon name="refresh" size={14} /></button>
      </div>
      <div style={{ padding: "0 25px" }}>
        <Tabs value={tab} onChange={setTab} items={[{ value: "holds", label: "Confirmation desk", count: holdList.length }, { value: "tickets", label: "All tickets", count: tickets.data?.tickets.length }]} />
      </div>
      {tab === "holds" ? (
        holds.error ? <div className="panel-body"><ErrorState error={holds.error} onRetry={holds.reload} /></div> : holds.loading && !holds.data ? <div className="panel-body"><Skeleton /></div> : !holdList.length ? <EmptyState title="No pending holds" icon="ticket">Every booked seat is confirmed or released.</EmptyState> : (
          <div className="table-scroll">
            <table>
              <thead><tr><th scope="col">Holder</th><th scope="col">Code</th><th scope="col" className="amount-cell">Due</th><th scope="col">Hold left</th><th scope="col">Confirm payment</th></tr></thead>
              <tbody>{holdList.map((t) => <HoldRow key={t.id} ticket={t} onDone={refresh} />)}</tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="task-filters" style={{ padding: "0 25px 16px" }}>
            <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value as TicketStatus | "all")} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="pending_payment">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          {tickets.error ? <div className="panel-body"><ErrorState error={tickets.error} onRetry={tickets.reload} /></div> : tickets.loading && !tickets.data ? <div className="panel-body"><Skeleton /></div> : !ticketList.length ? <EmptyState title="No tickets" icon="ticket">Nothing matches this filter.</EmptyState> : (
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Holder</th><th scope="col">Code</th><th scope="col">Status</th><th scope="col" className="amount-cell">Price</th><th scope="col">Paid</th><th scope="col">Checked in</th></tr></thead>
                <tbody>
                  {ticketList.map((t) => (
                    <tr key={t.id}>
                      <td><Person name={t.holderName} sub={t.memberId ? "Member" : `Guest · ${t.guestEmail ?? ""}`} /></td>
                      <td><span className="payment-ref">{t.shortCode}</span></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td className="amount-cell">{money(t.pricePaise)}</td>
                      <td>{t.paidAt ? <><When iso={t.paidAt} />{t.paymentReference ? <span className="payment-ref">Ref {t.paymentReference}</span> : null}</> : "—"}</td>
                      <td>{t.checkedInAt ? <When iso={t.checkedInAt} /> : "—"}</td>
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
  const report = useLoad(() => api.get<FullReport>(`/api/events/${encodeURIComponent(eventId)}/report`), [eventId, version]);
  const r = report.data;
  return (
    <Card kicker="HOW IT IS GOING" title="Report" actions={<button type="button" className="text-button" onClick={() => void report.reload()}>Refresh<Icon name="refresh" size={14} /></button>}>
      {report.error ? <ErrorState error={report.error} onRetry={report.reload} /> : !r ? <Skeleton /> : (
        <>
          <div className="metrics-grid" style={{ marginBottom: 0, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Stat label="Tickets sold" value={String(r.ticketsSold).padStart(2, "0")} hint={`${r.tickets.pendingPayment} pending · ${r.tickets.cancelled} cancelled · ${r.tickets.expired} expired`} tone="blue" icon="ticket" />
            <Stat label="Attendance" value={String(r.attendance).padStart(2, "0")} hint="Checked in at the door" tone="green" icon="door" />
            <Stat label="Pending payment" value={String(r.tickets.pendingPayment).padStart(2, "0")} hint="Holds waiting at the desk" tone="accent" icon="clock" />
            <Stat label="Realized revenue" value={amount(r.realizedRevenuePaise)} hint="Ticket income in the ledger" tone="dark" icon="wallet" />
          </div>
          <div className="event-report" aria-label={`Fundraiser report for ${r.eventTitle}`}>
            <div className="event-report-heading">
              <span className="eyebrow">FUNDRAISER</span>
              <span className={`badge ${r.fundraiser.onTrack ? "green" : "amber"}`}>{r.fundraiser.onTrack ? "On track" : "Needs attention"}</span>
            </div>
            <div className="report-progress-label">
              <span>{amount(r.fundraiser.raisedPaise)} raised of {amount(r.fundraiser.goalPaise)} goal{r.fundraiser.goalPaise > 0 ? ` · ${amount(r.fundraiser.remainingPaise)} to go` : ""}</span>
              <strong>{r.fundraiser.percent}%</strong>
            </div>
            <div className="capacity-bar report-bar"><span style={{ width: `${Math.min(100, Math.max(0, r.fundraiser.percent))}%` }} /></div>
            <div className="report-task-summary">
              <span>{r.tasks.total} tasks</span>
              <span>{r.tasks.done} done</span>
              <span>{r.tasks.inProgress} in progress</span>
              <span className={r.tasks.overdue > 0 ? "overdue-text" : ""}>{r.tasks.overdue} overdue</span>
            </div>
            <div className="mx-mt"><Link href={`/app/tasks?eventId=${encodeURIComponent(eventId)}`} className="text-button">Open tasks for this event<Icon name="arrow" size={16} /></Link></div>
          </div>
        </>
      )}
    </Card>
  );
}

export default function EventDetailPage() {
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
        <EmptyState title={notFound ? "Event not found" : "Could not load this event"} icon="calendar" action={<LinkButton href="/app/events">Back to events</LinkButton>}>{notFound ? "It may be a draft you cannot see, or it was removed." : describeError(event.error)}</EmptyState>
      </section>
    );
  }
  if (!e) return <section className="panel task-create-panel"><Skeleton rows={8} /></section>;

  const myTicket = (mine.data?.tickets ?? []).find((t) => t.eventId === e.id && LIVE.includes(t.status));
  const reloadMine = async () => { await Promise.all([mine.reload(), event.reload()]); };

  return (
    <>
      <PageHead
        eyebrow={<><Link href="/app/events">EVENTS</Link> <span>/</span> {e.title.toUpperCase()}</>}
        title={e.title}
        description={<>{dateTime(e.startsAt)} · {e.venue} · <strong>{e.available}</strong> of {e.capacity} seats left</>}
        actions={<>
          {e.status !== "published" ? <StatusBadge status={e.status} /> : null}
          {can("tickets:check_in") ? <Link href={`/app/events/${e.id}/door`} className="button primary"><Icon name="scan" size={18} />Door scanner</Link> : null}
          {can("events:write") ? <Link href={`/app/events/${e.id}/edit`} className="button secondary"><Icon name="edit" size={16} />Edit</Link> : null}
        </>}
      />
      {e.status === "cancelled" ? <div className="error-inline" role="status"><span>This event is cancelled. No new bookings are accepted.</span></div> : e.status === "draft" ? <div className="outstanding-notice"><div className="mx-row" style={{ flexWrap: "nowrap" }}><Icon name="eye" size={16} /><div><strong>Draft.</strong><p>Only organizers can see this event.</p></div></div></div> : null}

      <div className="overview-grid">
        <div className="mx-stack">
          {e.description ? <Card kicker="ABOUT" title="What to expect"><p className="mx-prose">{e.description}</p></Card> : null}
          {can("payments:confirm") ? <Desk eventId={e.id} version={version} onChange={bump} /> : null}
          {can("events:report") ? <Report eventId={e.id} version={version} /> : null}
          <GuestBookingCard event={e} />
        </div>
        <div className="mx-stack">
          {mine.loading && !mine.data ? <Card><Skeleton rows={3} /></Card> : myTicket ? <MyTicketCard ticket={myTicket} event={e} reload={reloadMine} /> : <BookingCard event={e} reloadMine={reloadMine} />}
          <Card kicker="TICKETS" title="Pricing">
            <KeyValue items={[
              { label: "Members (active dues)", value: money(e.memberPricePaise) },
              { label: "Guests & expired", value: money(e.guestPricePaise) },
              { label: "Capacity", value: `${e.capacity} seats` },
              { label: "Status", value: <StatusBadge status={e.status} /> },
            ]} />
          </Card>
        </div>
      </div>
      <PreviewNote>Payment is an officer-recorded reference at the desk. Admission at the door depends on a paid ticket, not on membership alone.</PreviewNote>
    </>
  );
}
