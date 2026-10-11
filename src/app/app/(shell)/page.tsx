"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dashboard, Task } from "@/lib/contracts";
import { ReorderList } from "@/components/ui/reorder-list";
import { WorkspaceMainSkeleton } from "@/app/skeleton";
import { api, describeError, useLoad } from "../_lib/api";
import { useSession } from "../_lib/session";
import { amount, date } from "../_lib/format";
import { Icon } from "../_components/icons";
import { Button, Card, EmptyState, ErrorState, PageHead, Person, PreviewNote, Stat, TextLink } from "../_components/ui";

/* Azman's overview, section for section: metrics, calendar panel, team to-dos
 * (drag to reorder, long-press/drag to complete), member directory, noticeboard. */

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];
const STATUS_LABEL: Record<Task["status"], string> = { todo: "To do", in_progress: "In progress", done: "Done" };

function monthShort(iso: string) { return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)).toUpperCase(); }
function dayOfMonth(iso: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)); }

export default function OverviewPage() {
  const router = useRouter();
  const { user, can } = useSession();
  const dashboard = useLoad(() => api.get<Dashboard>("/api/dashboard"));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todoOrder, setTodoOrder] = useState<string[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [saving, setSaving] = useState<string[]>([]);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (dashboard.data) setTasks(dashboard.data.tasks); }, [dashboard.data]);
  useEffect(() => {
    const ids = tasks.filter((t) => t.status === "todo").map((t) => t.id);
    setTodoOrder((current) => {
      const next = [...current.filter((id) => ids.includes(id)), ...ids.filter((id) => !current.includes(id))];
      return next.length === current.length && next.every((id, i) => id === current[i]) ? current : next;
    });
  }, [tasks]);

  if (!user) return null;
  const data = dashboard.data;
  const canMove = (task: Task) => can("tasks:write") || task.assigneeId === user.id;

  async function move(task: Task, status: Task["status"]) {
    if (task.status === status || saving.includes(task.id) || !canMove(task)) return;
    setSaving((s) => [...s, task.id]);
    setTaskErrors((c) => ({ ...c, [task.id]: "" }));
    try {
      const result = await api.post<{ status: Task["status"] }>(`/api/tasks/${encodeURIComponent(task.id)}/status`, { status });
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: result.status } : item)));
    } catch (caught) {
      setTaskErrors((c) => ({ ...c, [task.id]: describeError(caught, "Could not update the task.") }));
    } finally {
      setSaving((s) => s.filter((id) => id !== task.id));
    }
  }

  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <>
      <PageHead
        eyebrow={<>{(data?.club.name ?? "Your club").toUpperCase()} <span>/</span> WORKSPACE</>}
        title="Your club,"
        titleAccent="in sync."
        description="A little less admin. A lot more campus life."
        actions={can("members:create") ? <Button variant="primary" onClick={() => router.push("/app/members?add=1")}><Icon name="plus" size={18} />Add member</Button> : null}
      />

      {dashboard.error ? <ErrorState error={dashboard.error} onRetry={dashboard.reload} title="The workspace could not load" /> : null}
      {dashboard.loading && !data ? <WorkspaceMainSkeleton /> : null}

      {data ? (
        <>
          <section className="metrics-grid" aria-label="Key figures">
            <Stat label="Total members" value={data.metrics.members} hint={`${data.metrics.activeMembers} active memberships`} tone="blue" icon="people" />
            <Stat label="Upcoming events" value={String(data.metrics.upcomingEvents).padStart(2, "0")} hint="Moments to bring everyone together" tone="accent" icon="calendar" />
            <Stat label="Open tasks" value={String(openTasks).padStart(2, "0")} hint={`${doneTasks} tasks completed`} tone="green" icon="check" />
            {data.access.finance
              ? <Stat label="Club balance" value={amount(data.metrics.balancePaise)} hint="Recorded income minus expenses" tone="dark" icon="wallet" />
              : <Stat label="Announcements" value={String(data.announcements.length).padStart(2, "0")} hint="On the club noticeboard" tone="dark" icon="megaphone" />}
          </section>

          <div className="overview-grid">
            <section className="panel events-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">MAKE SOME MEMORIES</div><h2>On the calendar</h2></div>
                <TextLink href="/app/events">All events</TextLink>
              </div>
              {data.events.length ? (
                <div className="event-list">
                  {data.events.slice(0, 4).map((event, index) => (
                    <Link key={event.id} href={`/app/events/${event.id}`} className="event-row">
                      <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{monthShort(event.startsAt)}</span><strong>{dayOfMonth(event.startsAt)}</strong></div>
                      <div className="event-info">
                        <h3>{event.title}</h3>
                        <p>{event.venue}</p>
                        <div className="event-capacity">
                          <div className="capacity-track"><span style={{ width: `${event.capacity ? Math.min(100, (event.registered / event.capacity) * 100) : 0}%` }} /></div>
                          <span>{event.registered}/{event.capacity} registered</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title="Nothing on the calendar" icon="calendar">{can("events:write") ? "Create the first event from the Events page." : "Check back soon."}</EmptyState>}
              <div className="panel-footnote"><span className="tiny-dot" />Tickets hold a seat for 30 minutes until an officer confirms payment.</div>
            </section>

            <section className="panel tasks-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">LITTLE STEPS, BIG THINGS</div><h2>Team to-dos</h2></div>
                <TextLink href="/app/tasks">View all</TextLink>
              </div>
              {tasks.length ? (
                <div className="dashboard-kanban" aria-label="Team to-dos">
                  {STATUSES.map((status) => {
                    const column = tasks.filter((t) => t.status === status).sort((a, b) => status !== "todo" ? 0 : (todoOrder.indexOf(a.id) === -1 ? Number.MAX_SAFE_INTEGER : todoOrder.indexOf(a.id)) - (todoOrder.indexOf(b.id) === -1 ? Number.MAX_SAFE_INTEGER : todoOrder.indexOf(b.id)));
                    return (
                      <section key={status} className={`dashboard-kanban-column ${status} ${dragged ? "is-drop-target" : ""}`.trim()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragged; const task = tasks.find((t) => t.id === id); setDragged(null); if (task) void move(task, status); }}>
                        <header><span className={`status-dot ${status}`} aria-hidden="true" /><span>{STATUS_LABEL[status]}</span><b>{column.length}</b></header>
                        <div className="dashboard-kanban-cards">
                          {column.length ? status === "todo" ? (
                            <ReorderList items={column} getId={(t) => t.id} getLabel={(t) => t.title} onReorder={(next) => setTodoOrder(next.map((t) => t.id))} onLongPress={(t) => void move(t, "done")} onExternalDragStart={(t) => setDragged(t.id)} onExternalDragEnd={() => setDragged(null)} label="To do" disabled={false} itemClassName="dashboard-reorder-item" showGrip={false}>
                              {(task) => (
                                <div>
                                  <div className={`dashboard-task-card ${saving.includes(task.id) ? "completing" : ""}`.trim()} title="Drag to reorder or move; long-press to complete">
                                    <span className="dashboard-task-title">{task.title}</span>
                                    <span className="dashboard-task-assignee">{saving.includes(task.id) ? "Saving…" : task.assignee || "Unassigned"}</span>
                                  </div>
                                  {taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}
                                </div>
                              )}
                            </ReorderList>
                          ) : column.map((task) => (
                            <div key={task.id}>
                              <button type="button" disabled={saving.includes(task.id) || !canMove(task)} draggable={!saving.includes(task.id) && canMove(task)} className={`dashboard-task-card ${task.status === "done" ? "completed" : ""} ${saving.includes(task.id) ? "completing" : ""}`.trim()} onClick={() => void move(task, task.status === "done" ? "todo" : "done")} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); setDragged(task.id); }} onDragEnd={() => setDragged(null)} title="Click to toggle done; drag between columns">
                                <span className="dashboard-task-title">{task.title}</span>
                                <span className="dashboard-task-assignee">{saving.includes(task.id) ? "Saving…" : task.assignee || "Unassigned"}</span>
                              </button>
                              {taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}
                            </div>
                          )) : <p className="dashboard-kanban-empty">Nothing here yet.</p>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : <EmptyState title="No tasks yet" icon="check">{can("tasks:write") ? "Create the first task from the Tasks page." : "Tasks assigned to you will appear here."}</EmptyState>}
            </section>
          </div>

          <div className="overview-bottom">
            <section className="panel members-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">THE HEART OF YOUR CLUB</div><h2>Member directory</h2></div>
                {data.access.members ? <TextLink href="/app/members">All members</TextLink> : null}
              </div>
              {data.access.members && data.members.length ? (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">Member</th><th scope="col">Joined</th><th scope="col">Membership dues</th><th scope="col">Expires</th></tr></thead>
                    <tbody>
                      {data.members.slice(0, 6).map((member) => (
                        <tr key={member.id}>
                          <td><Link href={`/app/members/${member.id}`}><Person name={member.name} sub={member.email} /></Link></td>
                          <td>{date(member.joinedAt)}</td>
                          <td><span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>{member.duesStatus === "paid" ? "Paid" : "Unpaid"}</span></td>
                          <td>{member.expiresOn ? date(member.expiresOn) : "Not set"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState title={data.access.members ? "No members yet" : "Directory is officer-only"} icon="people">{data.access.members ? "Add the first member." : "Officers see the member directory with contact details. Your membership status is on your pass."}</EmptyState>}
            </section>

            {data.announcements.length ? (
              <article className="notice-card">
                <span className="notice-icon"><Icon name="megaphone" size={20} /></span>
                <div className="eyebrow">FROM THE NOTICEBOARD</div>
                <h2>{data.announcements[0].title}</h2>
                <p>{data.announcements[0].body.length > 160 ? `${data.announcements[0].body.slice(0, 160)}…` : data.announcements[0].body}</p>
                <span className="notice-date">{date(data.announcements[0].publishedAt)}</span>
                <TextLink href="/app/announcements">Read announcements</TextLink>
              </article>
            ) : (
              <Card kicker="FROM THE NOTICEBOARD" title="Nothing published yet">
                <p className="mx-muted mx-small">{can("announcements:write") ? "Publish the first announcement from the Announcements page." : "Announcements will appear here."}</p>
              </Card>
            )}
          </div>

          <PreviewNote>Payments are officer-recorded references; delivery of announcements is a simulated outbox. See each section for the details.</PreviewNote>
        </>
      ) : null}
    </>
  );
}
