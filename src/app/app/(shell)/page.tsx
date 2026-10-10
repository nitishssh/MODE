"use client";

import Link from "next/link";
import type { Dashboard, Notification, TaskDetails } from "@/lib/contracts";
import { api, useLoad } from "../_lib/api";
import { useSession } from "../_lib/session";
import { dateTime, longDate, money, plural, relative } from "../_lib/format";
import { Badge, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton, Stat, StatusBadge, When } from "../_components/ui";
import { Icon } from "../_components/icons";

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const { user, pass, can } = useSession();
  const dashboard = useLoad(() => api.get<Dashboard>("/api/dashboard"));
  const myTasks = useLoad(() => api.get<TaskDetails[]>("/api/tasks?mine=true"));
  const notifications = useLoad(() => api.get<{ notifications: Notification[] }>("/api/notifications"));

  if (!user) return null;
  const data = dashboard.data;
  const openTasks = (myTasks.data ?? []).filter((task) => task.status !== "done");
  const unread = (notifications.data?.notifications ?? []).filter((n) => !n.readAt);
  const firstName = user.name.split(" ")[0];

  const quickLinks = [
    can("members:read") && { href: "/app/members", label: "Member directory", icon: Icon.people, hint: "Dues, roles and renewals" },
    { href: "/app/events", label: "Events", icon: Icon.calendar, hint: can("events:write") ? "Create, publish, confirm payments" : "Book your seat" },
    { href: "/app/shop", label: "Shop", icon: Icon.bag, hint: can("orders:fulfil") ? "Orders desk and stock" : "Order club merchandise" },
    { href: "/app/tasks", label: "Tasks", icon: Icon.checkbox, hint: can("tasks:write") ? "Assign and track volunteer work" : "Your assignments" },
    { href: "/app/expenses", label: "Expenses", icon: Icon.receipt, hint: can("expenses:review") ? "Review and pay claims" : "Submit a reimbursement" },
    can("ledger:read") && { href: "/app/treasury", label: "Treasury", icon: Icon.wallet, hint: "Ledger, summary and export" },
    can("tickets:check_in") && { href: "/app/events?door=1", label: "Door scanner", icon: Icon.scan, hint: "Admit ticket holders" },
    { href: "/app/pass", label: "Member pass", icon: Icon.qr, hint: "Your QR and door code" },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));

  return (
    <>
      <PageHead
        eyebrow={longDate(new Date().toISOString())}
        title={`${greeting()}, ${firstName}.`}
        description={data ? `${data.club.name}. ${data.club.description}` : undefined}
        actions={pass ? <Badge tone={pass.membership === "active" ? "green" : pass.membership === "expired" ? "red" : "neutral"} dot>Membership {pass.membership}{pass.expiresOn ? ` · through ${pass.expiresOn}` : ""}</Badge> : null}
      />

      {dashboard.error ? <ErrorState error={dashboard.error} onRetry={dashboard.reload} /> : null}

      <div className="mx-grid mx-grid-4 mx-mb">
        <Stat label="Members" value={data ? data.metrics.members : "—"} hint={data ? `${data.metrics.activeMembers} with active membership` : undefined} tone="blue" />
        <Stat label="Upcoming events" value={data ? data.metrics.upcomingEvents : "—"} hint="Published and still ahead" tone="accent" />
        <Stat label="Your open tasks" value={myTasks.data ? openTasks.length : "—"} hint={openTasks.some((t) => t.overdue) ? `${openTasks.filter((t) => t.overdue).length} overdue` : "Nothing overdue"} tone="green" />
        {data?.access.finance
          ? <Stat label="Club balance" value={money(data.metrics.balancePaise)} hint="Income minus paid expenses" tone="amber" />
          : <Stat label="Unread notices" value={notifications.data ? unread.length : "—"} hint="Announcements and reminders" tone="amber" />}
      </div>

      <div className="mx-grid mx-grid-main">
        <div className="mx-stack">
          <Card title="Upcoming events" actions={<LinkButton href="/app/events" size="sm">All events<Icon.arrow /></LinkButton>}>
            {dashboard.loading && !data ? <Skeleton /> : !data?.events.length ? <EmptyState title="No upcoming events">{can("events:write") ? "Create the first one from the Events page." : "Check back soon."}</EmptyState> : (
              <div className="mx-list">
                {data.events.slice(0, 5).map((event) => (
                  <Link key={event.id} href={`/app/events/${event.id}`} className="mx-list-item">
                    <div className="mx-grow">
                      <strong>{event.title}</strong>
                      <small>{dateTime(event.startsAt)} · {event.venue}</small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="mx-strong">{money(event.memberPricePaise)}</span>
                      <small className="mx-muted" style={{ display: "block" }}>{Math.max(0, event.capacity - event.registered)} seats left</small>
                    </div>
                    <Icon.arrow style={{ color: "var(--mx-muted)" }} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Your tasks" actions={<LinkButton href="/app/tasks" size="sm">Task board<Icon.arrow /></LinkButton>}>
            {myTasks.loading && !myTasks.data ? <Skeleton rows={3} /> : myTasks.error ? <ErrorState error={myTasks.error} onRetry={myTasks.reload} /> : !openTasks.length ? <EmptyState title="You're all caught up">No open tasks assigned to you.</EmptyState> : (
              <div className="mx-list">
                {openTasks.slice(0, 5).map((task) => (
                  <Link key={task.id} href="/app/tasks" className="mx-list-item">
                    <div className="mx-grow">
                      <strong>{task.title}</strong>
                      <small>{task.dueAt ? `Due ${relative(task.dueAt)}` : "No deadline"}{task.eventTitle ? ` · ${task.eventTitle}` : ""}</small>
                    </div>
                    {task.overdue ? <Badge tone="red" dot>Overdue</Badge> : <StatusBadge status={task.status} />}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {data?.access.finance && data.transactions.length ? (
            <Card title="Recent money movement" actions={<LinkButton href="/app/treasury" size="sm">Treasury<Icon.arrow /></LinkButton>}>
              <div className="mx-list">
                {data.transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="mx-list-item">
                    <div className="mx-grow"><strong>{tx.description}</strong><small><When iso={tx.occurredAt} /></small></div>
                    <span className={`mx-strong mx-num ${tx.kind === "income" ? "" : ""}`} style={{ color: tx.kind === "income" ? "var(--mx-green)" : "var(--mx-red)" }}>{tx.kind === "income" ? "+" : "−"}{money(tx.amountPaise)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="mx-stack">
          <Card title="Go to" tone="tight">
            <div className="mx-list">
              {quickLinks.map((item) => {
                const I = item.icon;
                return (
                  <Link key={item.href + item.label} href={item.href} className="mx-list-item">
                    <span className="mx-iconbtn" style={{ pointerEvents: "none" }}><I /></span>
                    <div className="mx-grow"><strong>{item.label}</strong><small>{item.hint}</small></div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card title="Latest announcements" actions={<LinkButton href="/app/announcements" size="sm">All</LinkButton>}>
            {dashboard.loading && !data ? <Skeleton rows={3} /> : !data?.announcements.length ? <p className="mx-muted">Nothing published yet.</p> : (
              <div className="mx-list">
                {data.announcements.slice(0, 3).map((item) => (
                  <Link key={item.id} href={`/app/announcements/${item.id}`} className="mx-list-item">
                    <div className="mx-grow"><strong>{item.title}</strong><small>{relative(item.publishedAt)}</small></div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {unread.length ? (
            <Card title={`${plural(unread.length, "unread notification")}`} tone="ink" actions={<LinkButton href="/app/notifications" size="sm">Open</LinkButton>}>
              <div className="mx-stack-sm">
                {unread.slice(0, 3).map((n) => <div key={n.id}><strong>{n.title}</strong><div className="mx-muted mx-small">{relative(n.createdAt)}</div></div>)}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
