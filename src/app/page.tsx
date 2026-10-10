"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Dashboard, Member } from "@/lib/contracts";

type Section = "Overview" | "Members" | "Events" | "Announcements" | "Merchandise" | "Volunteers" | "Finance";
type IconName = "grid" | "people" | "calendar" | "megaphone" | "bag" | "check" | "wallet" | "arrow" | "plus" | "close" | "chevron";
const navigation: { label: Section; icon: IconName }[] = [
  { label: "Overview", icon: "grid" }, { label: "Members", icon: "people" },
  { label: "Events", icon: "calendar" }, { label: "Announcements", icon: "megaphone" },
  { label: "Merchandise", icon: "bag" }, { label: "Volunteers", icon: "check" },
  { label: "Finance", icon: "wallet" },
];
const descriptions: Record<Section, string> = {
  Overview: "A little less admin. A lot more campus life.",
  Members: "The people who make your community happen.",
  Events: "Bring people together, from the first ticket to the last check-in.",
  Announcements: "Give every update a home your members can find.",
  Merchandise: "Club essentials, with orders and stock in one place.",
  Volunteers: "Good things happen when everyone knows their part.",
  Finance: "A clear view of what comes in and what goes out.",
};
const currency = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const date = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
const day = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
const month = (value: string) => new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
const initials = (name: string) => name.split(" ").slice(0, 2).map(part => part[0]).join("");
const taskLabel = { todo: "To do", in_progress: "In progress", done: "Done" };

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-14 5h3" /></>,
    megaphone: <><path d="M3 10v5h5l11 5V4L8 10H3Zm5 5 2 6h3l-2-5M22 9v6" /></>,
    bag: <><path d="M5 8h14l2 13H3L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7 12 3 3 7-7" /></>,
    wallet: <><path d="M21 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V7M21 13h-5v4h5" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><span className="empty-icon"><Icon name="grid" size={24} /></span><h3>{title}</h3><p>{children}</p></div>;
}

function PreviewNote({ children }: { children: ReactNode }) {
  return <div className="preview-note"><span className="badge neutral">Starter preview</span><p>{children}</p></div>;
}

function MemberTable({ members }: { members: Member[] }) {
  if (!members.length) return <Empty title="Your community starts here">Add your first member to start building the club directory.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th scope="col">Member</th><th scope="col">Joined</th><th scope="col">Membership dues</th><th scope="col">Expires</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td><div className="person"><span className="avatar">{initials(member.name)}</span><span><strong>{member.name}</strong><span className="subtext">{member.email}</span></span></div></td><td>{date(member.joinedAt)}</td><td><span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>{member.duesStatus === "paid" ? "Paid" : "Unpaid"}</span></td><td>{member.expiresOn ? date(member.expiresOn) : "Not set"}</td></tr>)}</tbody></table></div>;
}

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("We couldn’t load the workspace. Check that the server is running and try again.");
      setData(await response.json() as Dashboard);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t load the workspace. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showForm) nameInput.current?.focus(); }, [showForm]);

  function openMembers() {
    setSection("Members");
    setShowForm(true);
    setFormError("");
    setSuccess("");
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setFormError("");
    setSuccess("");
    try {
      const response = await fetch("/api/members", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(values.get("name") ?? "").trim(), email: String(values.get("email") ?? "").trim() }),
      });
      const result = await response.json() as { member?: Member; error?: string };
      if (!response.ok) throw new Error(result.error || "The member could not be added. Please try again.");
      setSuccess(`${result.member?.name ?? "Member"} was added. Their membership dues are unpaid.`);
      form.reset();
      setShowForm(false);
      await load();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "The member could not be added. Please try again."); }
    finally { setSaving(false); }
  }

  const income = data?.transactions.filter(item => item.kind === "income").reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const expenses = data?.transactions.filter(item => item.kind === "expense").reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const openTasks = data?.tasks.filter(task => task.status !== "done") ?? [];
  const clubName = data?.club.name ?? "Club workspace";
  const clubInitials = initials(clubName);

  return <div className="workspace">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <a className="brand" href="/" aria-label="MODE home"><span className="brand-mark"><span /><span /><span /></span>MODE<span className="brand-dot">.</span></a>
      <div className="workspace-switch"><span className="club-monogram">{clubInitials}</span><span><strong>{clubName}</strong><small>Student organization</small></span></div>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav aria-label="Main navigation">{navigation.map(item => <button key={item.label} type="button" className={`nav-item ${section === item.label ? "active" : ""}`} aria-current={section === item.label ? "page" : undefined} onClick={() => { setSection(item.label); setSuccess(""); }}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Members" && data && <span className="nav-count">{data.metrics.members}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="small-star">✳</span><h3>Made for the<br />people who make it happen.</h3><p>One home for your campus community.</p></div><a className="repo-link" href="https://github.com/users/nitishssh/projects/14" target="_blank" rel="noreferrer">Team project board <Icon name="arrow" size={16} /><span className="sr-only"> (opens in a new tab)</span></a><a className="repo-link source-link" href="https://github.com/nitishssh/MODE" target="_blank" rel="noreferrer">Source on GitHub <Icon name="arrow" size={16} /><span className="sr-only"> (opens in a new tab)</span></a><div className="sidebar-profile"><span className="profile-avatar">{clubInitials}</span><span><strong>Demo workspace</strong><small>Local starter · no sign-in</small></span></div></div>
    </aside>

    <div className="workspace-body">
      <header className="topbar"><div className="breadcrumb">Workspace <Icon name="chevron" size={13} /><span>{section}</span></div><div className="topbar-right"><span className="demo-indicator"><span />Fictional sample data</span><span className="top-avatar" aria-label="Demo workspace">{clubInitials}</span></div></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><div className="eyebrow">{clubName.toUpperCase()} <span>/</span> WORKSPACE</div><h1>{section === "Overview" ? <>Your club, <span>in sync.</span></> : section}</h1><p>{descriptions[section]}</p></div>{(section === "Overview" || section === "Members") && <button className="button primary" type="button" onClick={openMembers} disabled={loading || !!error}><Icon name="plus" size={18} />Add member</button>}</div>

        {success && <div className="success-message" role="status"><Icon name="check" size={18} />{success}</div>}
        {loading && <div className="loading-state" role="status" aria-live="polite"><span className="loader" /><span>Getting your workspace ready…</span></div>}
        {!loading && error && <div className="error-state" role="alert"><h2>Let’s try that again.</h2><p>{error}</p><button className="button primary" type="button" onClick={() => void load()}>Retry loading</button></div>}

        {!loading && !error && data && <>
          {section === "Overview" && <>
            <section className="metrics-grid" aria-label="Club at a glance">
              <Metric label="Total members" value={String(data.metrics.members)} detail={`${data.metrics.activeMembers} active memberships`} icon="people" color="lavender" />
              <Metric label="Upcoming events" value={String(data.metrics.upcomingEvents).padStart(2, "0")} detail="Moments to bring everyone together" icon="calendar" color="peach" />
              <Metric label="Open tasks" value={String(openTasks.length).padStart(2, "0")} detail={`${data.tasks.filter(task => task.status === "done").length} tasks completed`} icon="check" color="mint" />
              <Metric label="Club balance" value={currency(data.metrics.balancePaise)} detail="Recorded income minus expenses" icon="wallet" color="dark" />
            </section>

            <div className="overview-grid"><section className="panel events-panel"><PanelHeading kicker="MAKE SOME MEMORIES" title="On the calendar" action="All events" onClick={() => setSection("Events")} />{data.events.length ? <div className="event-list">{data.events.slice(0, 2).map((event, index) => <article className="event-row" key={event.id}><div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{month(event.startsAt)}</span><strong>{day(event.startsAt)}</strong></div><div className="event-info"><h3>{event.title}</h3><p>{event.venue}</p><div className="event-capacity"><span className="capacity-track"><span style={{ width: `${event.capacity > 0 ? Math.min(100, event.registered / event.capacity * 100) : 0}%` }} /></span><span>{event.registered}/{event.capacity} registered</span></div></div></article>)}</div> : <Empty title="Room for the next big thing">Events will appear here once they are recorded.</Empty>}<div className="panel-footnote"><span className="tiny-dot" />Event planning and ticketing are planned next.</div></section>
              <section className="panel tasks-panel"><PanelHeading kicker="LITTLE STEPS, BIG THINGS" title="Team to-dos" action="View all" onClick={() => setSection("Volunteers")} />{openTasks.length ? <div className="task-list">{openTasks.slice(0, 3).map(task => <div className="task-row" key={task.id}><span className={`task-symbol ${task.status === "in_progress" ? "working" : ""}`} aria-hidden="true">{task.status === "in_progress" ? "•" : ""}</span><div><h3>{task.title}</h3><p>{task.assignee || "Unassigned"}</p></div><span className={`badge ${task.status === "in_progress" ? "purple" : "neutral"}`}>{taskLabel[task.status]}</span></div>)}</div> : <Empty title="Nothing on the to-do list">Your team is all caught up.</Empty>}</section>
            </div>

            <div className="overview-bottom"><section className="panel members-panel"><PanelHeading kicker="THE HEART OF YOUR CLUB" title="Member directory" action="All members" onClick={() => setSection("Members")} /><MemberTable members={data.members.slice(0, 4)} /></section><section className="notice-card"><span className="notice-icon"><Icon name="megaphone" size={23} /></span><div className="eyebrow">FROM THE NOTICEBOARD</div>{data.announcements[0] ? <><h2>{data.announcements[0].title}</h2><p>{data.announcements[0].body}</p><span className="notice-date">{date(data.announcements[0].publishedAt)}</span></> : <><h2>A home for your updates.</h2><p>No announcements have been recorded yet.</p></>}<button type="button" className="text-button" onClick={() => setSection("Announcements")}>Read announcements <Icon name="arrow" size={17} /></button></section></div>
          </>}

          {section === "Members" && <>
            {showForm && <section className="panel member-form-panel" aria-labelledby="member-form-heading"><div className="form-heading"><div><h2 id="member-form-heading">Welcome someone new.</h2><p>Add a member to the local club directory. Dues start as unpaid.</p></div><button type="button" className="icon-button" aria-label="Close member form" onClick={() => setShowForm(false)} disabled={saving}><Icon name="close" /></button></div><form onSubmit={addMember}><div className="form-fields"><label>Full name<input ref={nameInput} name="name" placeholder="e.g. Alex Kumar" autoComplete="name" minLength={2} maxLength={120} required disabled={saving} /></label><label>Email address<input name="email" type="email" placeholder="alex@example.com" autoComplete="email" maxLength={254} required disabled={saving} /></label><button type="submit" className="button primary" disabled={saving}>{saving ? "Adding member…" : "Add to directory"}<Icon name="arrow" size={18} /></button></div>{formError && <p className="form-error" role="alert">{formError}</p>}</form></section>}
            <section className="panel"><PanelHeading title="Club directory" kicker={`${data.metrics.members} MEMBERS · ${data.metrics.activeMembers} ACTIVE`} /><MemberTable members={data.members} /></section><PreviewNote>Member creation is connected to the local database. Dues collection, benefits, membership editing, and renewal reminders are planned.</PreviewNote>
          </>}

          {section === "Events" && <><div className="event-cards">{data.events.map(event => <article key={event.id} className="panel event-card"><div className="event-card-top"><div className="date-tile coral"><span>{month(event.startsAt)}</span><strong>{day(event.startsAt)}</strong></div><span className="badge neutral">Recorded event</span></div><h2>{event.title}</h2><p>{event.venue} · {date(event.startsAt)}</p><div className="capacity-bar"><span style={{ width: `${event.capacity > 0 ? Math.min(100, event.registered / event.capacity * 100) : 0}%` }} /></div><div className="event-numbers"><span>{event.registered} registered</span><span>{event.capacity} capacity</span></div><div className="ticket-prices"><div><span>Member ticket</span><strong>{currency(event.memberPricePaise)}</strong></div><div><span>Guest ticket</span><strong>{currency(event.guestPricePaise)}</strong></div></div></article>)}</div>{!data.events.length && <section className="panel"><Empty title="An open calendar">No events are recorded yet.</Empty></section>}<PreviewNote>Event creation, ticket sales, member discounts, capacity enforcement, and check-in are planned. Prices and attendance shown here are sample records.</PreviewNote></>}

          {section === "Announcements" && <><div className="announcement-list">{data.announcements.map(item => <article key={item.id} className="panel announcement-card"><span className="announcement-symbol"><Icon name="megaphone" size={22} /></span><div><span className="eyebrow">{date(item.publishedAt)}</span><h2>{item.title}</h2><p>{item.body}</p></div></article>)}</div>{!data.announcements.length && <section className="panel"><Empty title="A quiet noticeboard">No announcements have been recorded yet.</Empty></section>}<PreviewNote>Publishing, editing, mailing-list delivery, and announcement history management are planned. No emails are sent by this starter.</PreviewNote></>}

          {section === "Merchandise" && <><div className="product-grid">{data.products.map((product, index) => <article key={product.id} className="panel product-card"><div className={`product-art art-${index % 3}`}><Icon name="bag" size={64} /><span>THE CLUB COLLECTION</span></div><div className="product-details"><div><h2>{product.name}</h2><span>{product.stock} in stock</span></div><strong>{currency(product.pricePaise)}</strong></div></article>)}</div>{!data.products.length && <section className="panel"><Empty title="Your next club essential">No merchandise is recorded yet.</Empty></section>}<PreviewNote>Product management, size variants, order collection, checkout, and stock updates are planned. No purchase can be made here yet.</PreviewNote></>}

          {section === "Volunteers" && <><div className="kanban-grid">{(["todo", "in_progress", "done"] as const).map(status => <section key={status} className="kanban-column" aria-label={taskLabel[status]}><h2><span className={`status-dot ${status}`} />{taskLabel[status]}<span className="column-count">{data.tasks.filter(task => task.status === status).length}</span></h2>{data.tasks.filter(task => task.status === status).map(task => <article key={task.id} className="task-card"><h3>{task.title}</h3><div className="person"><span className="avatar small">{task.assignee ? initials(task.assignee) : "?"}</span><span>{task.assignee || "Unassigned"}</span></div></article>)}{!data.tasks.some(task => task.status === status) && <p className="column-empty">No tasks here yet.</p>}</section>)}</div><PreviewNote>Task creation, assignment, deadlines, and status changes are planned. This is a read-only view of the sample volunteer board.</PreviewNote></>}

          {section === "Finance" && <><div className="finance-metrics"><Metric label="Recorded income" value={currency(income)} detail="Across all recorded transactions" icon="arrow" color="mint" /><Metric label="Recorded expenses" value={currency(expenses)} detail="Across all recorded transactions" icon="wallet" color="peach" /><Metric label="Club balance" value={currency(data.metrics.balancePaise)} detail="Income minus expenses" icon="wallet" color="dark" /></div><section className="panel"><PanelHeading title="Transaction ledger" kicker="EVERY RUPEE, ACCOUNTED FOR" />{data.transactions.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Description</th><th scope="col">Date</th><th scope="col">Type</th><th scope="col" className="amount-cell">Amount</th></tr></thead><tbody>{data.transactions.map(item => <tr key={item.id}><td><strong>{item.description}</strong></td><td>{date(item.occurredAt)}</td><td><span className={`badge ${item.kind === "income" ? "green" : "neutral"}`}>{item.kind === "income" ? "Income" : "Expense"}</span></td><td className={`amount-cell ${item.kind === "income" ? "positive" : ""}`}>{item.kind === "income" ? "+" : "−"}{currency(item.amountPaise)}</td></tr>)}</tbody></table></div> : <Empty title="A fresh ledger">There are no recorded transactions yet.</Empty>}</section><PreviewNote>Payment collection, receipts, expense entry, reimbursement approvals, and reconciliation are planned. These records do not represent real money or a bank balance.</PreviewNote></>}
        </>}

        <footer className="workspace-footer"><span><span className="footer-dot" />MODE starter workspace</span><p>Fictional seed records · Local database · Authentication and real payments are not implemented.</p></footer>
      </main>
    </div>
  </div>;
}

function Metric({ label, value, detail, icon, color }: { label: string; value: string; detail: string; icon: IconName; color: string }) {
  return <article className={`metric-card ${color === "dark" ? "metric-dark" : ""}`}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon name={icon} size={18} /></span></div><strong className="metric-value">{value}</strong><p>{detail}</p></article>;
}

function PanelHeading({ kicker, title, action, onClick }: { kicker: string; title: string; action?: string; onClick?: () => void }) {
  return <div className="panel-heading"><div><div className="eyebrow">{kicker}</div><h2>{title}</h2></div>{action && <button className="text-button" type="button" onClick={onClick}>{action}<Icon name="arrow" size={16} /></button>}</div>;
}
