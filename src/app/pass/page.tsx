"use client";

import { useCallback, useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import type { AuthMeResponse, MerchOrder, Ticket } from "@/lib/contracts";
import styles from "./pass.module.css";

type TicketResponse = { tickets: Ticket[] };
type OrderResponse = { orders: MerchOrder[] };

const membershipLabel = {
  active: "Active",
  expired: "Expired · renew with an officer",
  none: "Not yet joined",
} as const;

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

/** Loads the pass, tickets and orders. Resolves to null after redirecting a signed-out visitor. */
async function fetchPass(): Promise<{ me: AuthMeResponse; tickets: Ticket[]; orders: MerchOrder[] } | null> {
  const [meResponse, ticketsResponse, ordersResponse] = await Promise.all([
    fetch("/api/auth/me", { cache: "no-store" }),
    fetch("/api/tickets/mine", { cache: "no-store" }),
    fetch("/api/orders/mine", { cache: "no-store" }),
  ]);
  if (meResponse.status === 401) {
    window.location.assign("/login?next=/pass");
    return null;
  }
  if (!meResponse.ok) throw new Error("We could not load your member pass. Please retry.");
  return {
    me: await meResponse.json() as AuthMeResponse,
    tickets: ticketsResponse.ok ? (await ticketsResponse.json() as TicketResponse).tickets : [],
    orders: ordersResponse.ok ? (await ordersResponse.json() as OrderResponse).orders : [],
  };
}

export default function MemberPassPage() {
  const [data, setData] = useState<AuthMeResponse | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // State is only set in promise callbacks, so the initial load can run from an effect.
  const load = useCallback(() => fetchPass().then(
    (result) => {
      if (!result) return;
      setData(result.me);
      setTickets(result.tickets);
      setOrders(result.orders);
      setError("");
    },
    (cause: unknown) => setError(cause instanceof Error ? cause.message : "We could not load your member pass."),
  ).finally(() => {
    setLoading(false);
    setRefreshing(false);
  }), []);

  function reload(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    void load();
  }

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data?.pass.qrToken) return;
    void toDataURL(data.pass.qrToken, { width: 360, margin: 1, color: { dark: "#302b27", light: "#fdfaf5" } }).then(setQr).catch(() => setQr(""));
  }, [data?.pass.qrToken]);

  if (loading) return <main className={styles.loading}>Loading your member pass…</main>;
  if (error && !data) return <main className={styles.loading}><p role="alert">{error}</p><button onClick={() => reload()}>Try again</button></main>;
  if (!data) return null;

  const { user, pass } = data;
  return <main className={styles.page}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">MODE<span>·</span></a>
      <div><p>CLUB REGISTER</p><a href="/">Back to workspace →</a></div>
    </header>
    <section className={styles.content} aria-labelledby="pass-title">
      <p className={styles.kicker}>MEMBERSHIP / DOOR ACCESS</p>
      <h1 id="pass-title">My member pass</h1>
      <p className={styles.intro}>Keep this pass ready at the door. Your event ticket is checked separately by the volunteer.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.grid}>
        <article className={styles.passCard}>
          <div className={styles.passTop}><span>MODE / MEMBER PASS</span><span className={`${styles.status} ${styles[pass.membership]}`}>{membershipLabel[pass.membership]}</span></div>
          <h2>{user.name}</h2>
          <p className={styles.email}>{user.email}</p>
          <div className={styles.rule} />
          <p className={styles.label}>MEMBERSHIP</p>
          <p className={styles.membership}>{membershipLabel[pass.membership]}</p>
          <p className={styles.expires}>{pass.expiresOn ? `Through ${pass.expiresOn}` : "Ask an officer about joining."}</p>
          <p className={styles.label}>DOOR CODE</p>
          <p className={styles.code}>{pass.shortCode}</p>
        </article>
        <aside className={styles.qrPanel}>
          <p className={styles.label}>SCAN OR TYPE</p>
          {qr ? <img className={styles.qr} src={qr} alt={`Door QR code. Typed alternative: ${pass.shortCode}`} /> : <div className={styles.qrPlaceholder}>QR code unavailable<br />Use the code below</div>}
          <code>{pass.shortCode}</code>
          <p>Show this to the volunteer. Admission depends on a valid ticket for their selected event.</p>
          <button type="button" onClick={() => reload(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh membership"}</button>
        </aside>
      </div>
      <section className={styles.register} aria-labelledby="tickets-title">
        <div className={styles.sectionTitle}><div><p className={styles.kicker}>EVENT REGISTER</p><h2 id="tickets-title">My tickets</h2></div><a href="/events">Find an event →</a></div>
        {tickets.length ? <div className={styles.rows}>{tickets.map(ticket => <article className={styles.row} key={ticket.id}><div><strong>{ticket.holderName}</strong><span>{ticket.shortCode}</span></div><div><span>{ticket.pricing} ticket · {formatMoney(ticket.pricePaise)}</span><b className={styles[`ticket_${ticket.status}`]}>{ticket.status.replaceAll("_", " ")}</b></div>{ticket.holdExpiresAt && ticket.status === "pending_payment" && <small>Hold until {formatDate(ticket.holdExpiresAt)}</small>}</article>)}</div> : <p className={styles.empty}>No tickets yet. Open Events to reserve a seat.</p>}
      </section>
      <section className={styles.register} aria-labelledby="orders-title">
        <div className={styles.sectionTitle}><div><p className={styles.kicker}>CLUB SHOP</p><h2 id="orders-title">My merchandise</h2></div><a href="/merchandise">Open shop →</a></div>
        {orders.length ? <div className={styles.rows}>{orders.map(order => <article className={styles.row} key={order.id}><div><strong>{order.productName}</strong><span>{order.size} × {order.quantity}</span></div><div><span>{formatMoney(order.totalPaise)}</span><b className={styles.ticket_pending_payment}>{order.status.replaceAll("_", " ")}</b></div></article>)}</div> : <p className={styles.empty}>No merchandise orders yet.</p>}
      </section>
    </section>
  </main>;
}
