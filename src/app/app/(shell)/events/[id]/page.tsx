"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EventDetails, EventReport, Ticket, TicketStatus, WorkspaceEventReport } from "@/lib/contracts";
import { api, ApiError, describeError, useAction, useLoad } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { amount, dateTime, money, plural } from "../../../_lib/format";
import { Alert, Badge, Button, Card, Countdown, EmptyState, ErrorState, Input, KeyValue, LinkButton, PageHead, Progress, Select, Skeleton, Stat, StatusBadge, Table, Tabs, When } from "../../../_components/ui";
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
    <Card title="Book a seat">
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      <KeyValue items={[
        { label: "Your price", value: <><span className="mx-strong">{money(price)}</span> <span className="mx-muted">({pass?.membership === "active" ? "member rate" : "guest rate"})</span></> },
        { label: "Seats left", value: `${event.available} of ${event.capacity}` },
      ]} />
      <p className="mx-muted mx-small" style={{ margin: "12px 0" }}>{price === 0 ? "Free tickets are confirmed instantly." : "Your seat is held for 30 minutes. Pay an officer at the desk to confirm it."}</p>
      <Button variant="primary" loading={action.busy === "book"} disabled={!open || event.available === 0} onClick={() => void action.run("book", async () => {
        await api.post<{ ticket: Ticket }>(`/api/events/${encodeURIComponent(event.id)}/tickets`);
        await reloadMine();
      })}>
        <Icon.ticket />{!open ? "Bookings closed" : event.available === 0 ? "Sold out" : "Book my seat"}
      </Button>
    </Card>
  );
}

function MyTicketCard({ ticket, event, reload }: { ticket: Ticket; event: EventDetails; reload: () => Promise<void> }) {
  const action = useAction();
  return (
    <Card title="Your ticket" actions={<StatusBadge status={ticket.status} />}>
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      <div className="mx-row" style={{ alignItems: "flex-start", gap: 20 }}>
        {ticket.qrToken ? <QrCode value={ticket.qrToken} alt={`Ticket QR for ${event.title}. Typed code ${ticket.shortCode}`} size={160} /> : null}
        <div className="mx-stack-sm" style={{ flex: 1, minWidth: 200 }}>
          <div><p className="mx-eyebrow">Door code</p><p className="mx-code-big">{ticket.shortCode}</p></div>
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
              <div><Button variant="danger" size="sm" loading={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await reload(); })}>Cancel hold</Button></div>
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
    <Card title="Guest booking">
      <p className="mx-muted mx-small mx-mb">Book for someone who is not a club member at {money(event.guestPricePaise)}. They get a private ticket link to show at the door.</p>
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {result ? (
        <div className="mx-mb">
          <Alert tone="success" onDismiss={() => setResult(null)}>
            Ticket for <strong>{result.ticket.holderName}</strong> created. Door code <code className="mx-mono">{result.ticket.shortCode}</code>.{" "}
            <a className="mx-link" href={result.url} target="_blank" rel="noreferrer">Open ticket page <Icon.external style={{ width: 12, height: 12, verticalAlign: -1 }} /></a>
            {result.ticket.status === "pending_payment" ? " Payment is confirmed at the desk within 30 minutes." : null}
          </Alert>
        </div>
      ) : null}
      <form className="mx-form" onSubmit={submit}>
        <div className="mx-form-row">
          <div className="mx-field"><label htmlFor="guest-name">Guest name</label><Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} /></div>
          <div className="mx-field"><label htmlFor="guest-email">Guest email</label><Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></div>
        </div>
        <div className="mx-form-actions"><Button type="submit" loading={action.busy === "guest"} disabled={!open || event.available === 0}>{!open ? "Bookings closed" : event.available === 0 ? "Sold out" : "Book guest ticket"}</Button></div>
      </form>
    </Card>
  );
}

function HoldRow({ ticket, onDone }: { ticket: Ticket; onDone: () => Promise<void> }) {
  const [reference, setReference] = useState("");
  const action = useAction();
  return (
    <tr>
      <td><span className="mx-cell-title">{ticket.holderName}</span><span className="mx-cell-sub">{ticket.memberId ? "Member" : `Guest · ${ticket.guestEmail ?? ""}`}</span></td>
      <td><code className="mx-mono">{ticket.shortCode}</code></td>
      <td className="num">{money(ticket.pricePaise)}<span className="mx-cell-sub">{ticket.pricing}</span></td>
      <td><Countdown until={ticket.holdExpiresAt} onExpire={() => void onDone()} /></td>
      <td className="actions">
        <div className="mx-row" style={{ justifyContent: "flex-end" }}>
          <Input className="sm" placeholder="Payment reference" value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: 170 }} aria-label={`Payment reference for ${ticket.holderName}`} />
          <Button size="sm" variant="primary" disabled={reference.trim().length < 3} loading={action.busy === "confirm"} onClick={() => void action.run("confirm", async () => {
            try {
              await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/confirm`, { reference: reference.trim() });
            } catch (caught) {
              if (caught instanceof ApiError && caught.code === "hold_expired") { await onDone(); }
              throw caught;
            }
            await onDone();
          })}>Confirm</Button>
          <Button size="sm" variant="danger" loading={action.busy === "cancel"} onClick={() => void action.run("cancel", async () => { await api.post(`/api/tickets/${encodeURIComponent(ticket.id)}/cancel`); await onDone(); })}>Cancel</Button>
        </div>
        {action.error ? <p className="mx-error mx-small" role="alert" style={{ color: "var(--mx-red)", marginTop: 4, textAlign: "right" }}>{action.error}</p> : null}
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
    <Card title="Ticket desk" actions={<Button size="sm" onClick={() => void refresh()}><Icon.refresh />Refresh</Button>}>
      <Tabs value={tab} onChange={setTab} items={[{ value: "holds", label: "Confirmation desk", count: holdList.length }, { value: "tickets", label: "All tickets", count: tickets.data?.tickets.length }]} />
      {tab === "holds" ? (
        holds.error ? <ErrorState error={holds.error} onRetry={holds.reload} /> : holds.loading && !holds.data ? <Skeleton /> : !holdList.length ? <EmptyState title="No pending holds">Every booked seat is confirmed or released.</EmptyState> : (
          <Table head={<><th>Holder</th><th>Code</th><th className="num">Due</th><th>Hold left</th><th className="actions">Confirm payment</th></>}>
            {holdList.map((t) => <HoldRow key={t.id} ticket={t} onDone={refresh} />)}
          </Table>
        )
      ) : (
        <>
          <div className="mx-toolbar">
            <Select className="sm" value={filter} onChange={(e) => setFilter(e.target.value as TicketStatus | "all")} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="pending_payment">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </Select>
          </div>
          {tickets.error ? <ErrorState error={tickets.error} onRetry={tickets.reload} /> : tickets.loading && !tickets.data ? <Skeleton /> : !ticketList.length ? <EmptyState title="No tickets" /> : (
            <Table head={<><th>Holder</th><th>Code</th><th>Status</th><th className="num">Price</th><th>Paid</th><th>Checked in</th></>}>
              {ticketList.map((t) => (
                <tr key={t.id}>
                  <td><span className="mx-cell-title">{t.holderName}</span><span className="mx-cell-sub">{t.memberId ? "Member" : `Guest · ${t.guestEmail ?? ""}`}</span></td>
                  <td><code className="mx-mono">{t.shortCode}</code></td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="num">{money(t.pricePaise)}</td>
                  <td>{t.paidAt ? <><When iso={t.paidAt} />{t.paymentReference ? <span className="mx-cell-sub">Ref {t.paymentReference}</span> : null}</> : "—"}</td>
                  <td>{t.checkedInAt ? <When iso={t.checkedInAt} /> : "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </Card>
  );
}

function Report({ eventId, version }: { eventId: string; version: number }) {
  const report = useLoad(() => api.get<FullReport>(`/api/events/${encodeURIComponent(eventId)}/report`), [eventId, version]);
  const r = report.data;
  return (
    <Card title="Report" actions={<Button size="sm" onClick={() => void report.reload()}><Icon.refresh />Refresh</Button>}>
      {report.error ? <ErrorState error={report.error} onRetry={report.reload} /> : !r ? <Skeleton /> : (
        <div className="mx-stack">
          <div className="mx-grid mx-grid-3">
            <Stat label="Tickets sold" value={r.ticketsSold} hint={`${r.tickets.pendingPayment} pending · ${r.tickets.cancelled} cancelled · ${r.tickets.expired} expired`} tone="blue" />
            <Stat label="Attendance" value={r.attendance} hint="Checked in at the door" tone="green" />
            <Stat label="Realized revenue" value={amount(r.realizedRevenuePaise)} hint="Ticket income in the ledger" tone="amber" />
          </div>
          {r.fundraiser.goalPaise > 0 ? (
            <div>
              <div className="mx-between mx-small" style={{ marginBottom: 6 }}>
                <span><span className="mx-strong">Fundraiser</span> · {amount(r.fundraiser.raisedPaise)} of {amount(r.fundraiser.goalPaise)}</span>
                <Badge tone={r.fundraiser.onTrack ? "green" : "amber"} dot>{r.fundraiser.onTrack ? "On track" : `${amount(r.fundraiser.remainingPaise)} to go`}</Badge>
              </div>
              <Progress value={r.fundraiser.percent} />
            </div>
          ) : null}
          <KeyValue items={[
            { label: "Tasks", value: `${r.tasks.total} total · ${r.tasks.todo} to do · ${r.tasks.inProgress} in progress · ${r.tasks.done} done` },
            { label: "Overdue tasks", value: r.tasks.overdue ? <Badge tone="red" dot>{plural(r.tasks.overdue, "task")}</Badge> : "None" },
          ]} />
          <Link href={`/app/tasks?eventId=${encodeURIComponent(eventId)}`} className="mx-link mx-small">Open tasks for this event →</Link>
        </div>
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
    return <EmptyState title={notFound ? "Event not found" : "Could not load this event"} action={<LinkButton href="/app/events">Back to events</LinkButton>}>{notFound ? "It may be a draft you cannot see, or it was removed." : describeError(event.error)}</EmptyState>;
  }
  if (!e) return <Skeleton rows={8} />;

  const myTicket = (mine.data?.tickets ?? []).find((t) => t.eventId === e.id && LIVE.includes(t.status));
  const reloadMine = async () => { await Promise.all([mine.reload(), event.reload()]); };

  return (
    <>
      <p className="mx-small" style={{ marginBottom: 10 }}><Link href="/app/events" className="mx-link">← All events</Link></p>
      <PageHead
        eyebrow="Event"
        title={e.title}
        description={<>{dateTime(e.startsAt)} · {e.venue} · <span className="mx-strong">{e.available}</span> of {e.capacity} seats left</>}
        actions={<>
          {e.status !== "published" ? <StatusBadge status={e.status} /> : null}
          {can("tickets:check_in") ? <LinkButton href={`/app/events/${e.id}/door`} variant="accent"><Icon.scan />Door scanner</LinkButton> : null}
          {can("events:write") ? <LinkButton href={`/app/events/${e.id}/edit`}><Icon.edit />Edit</LinkButton> : null}
        </>}
      />
      {e.status === "cancelled" ? <div className="mx-mb"><Alert tone="warning">This event is cancelled. No new bookings are accepted.</Alert></div> : e.status === "draft" ? <div className="mx-mb"><Alert tone="info">Draft: only organizers can see this event.</Alert></div> : null}

      <div className="mx-grid mx-grid-main">
        <div className="mx-stack">
          {e.description ? <Card title="About"><p className="mx-prose">{e.description}</p></Card> : null}
          {can("payments:confirm") ? <Desk eventId={e.id} version={version} onChange={bump} /> : null}
          {can("events:report") ? <Report eventId={e.id} version={version} /> : null}
          <GuestBookingCard event={e} />
        </div>
        <div className="mx-stack">
          {mine.loading && !mine.data ? <Card><Skeleton rows={3} /></Card> : myTicket ? <MyTicketCard ticket={myTicket} event={e} reload={reloadMine} /> : <BookingCard event={e} reloadMine={reloadMine} />}
          <Card title="Pricing" tone="tight">
            <KeyValue items={[
              { label: "Members (active dues)", value: money(e.memberPricePaise) },
              { label: "Guests & expired", value: money(e.guestPricePaise) },
              { label: "Capacity", value: `${e.capacity} seats` },
              { label: "Status", value: <StatusBadge status={e.status} /> },
            ]} />
          </Card>
        </div>
      </div>
    </>
  );
}
