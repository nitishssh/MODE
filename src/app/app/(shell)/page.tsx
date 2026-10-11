"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dashboard, Task } from "@/lib/contracts";
import { ReorderList } from "@/components/ui/reorder-list";
import { WorkspaceMainSkeleton } from "@/app/skeleton";
import { api, useLoad } from "../_lib/api";
import { useT } from "../_lib/i18n";
import { useSession } from "../_lib/session";
import { Icon } from "../_components/icons";
import { Button, Card, EmptyState, ErrorState, PageHead, Person, PreviewNote, Stat, TextLink } from "../_components/ui";

/* Azman's overview, section for section: metrics, calendar panel, team to-dos
 * (drag to reorder, long-press/drag to complete), member directory, noticeboard. */

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];

export default function OverviewPage() {
  const router = useRouter();
  const { t, fmt, apiError } = useT();
  const { user, can } = useSession();
  const dashboard = useLoad(() => api.get<Dashboard>("/api/dashboard"));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todoOrder, setTodoOrder] = useState<string[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [saving, setSaving] = useState<string[]>([]);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (dashboard.data) setTasks(dashboard.data.tasks); }, [dashboard.data]);
  useEffect(() => {
    const ids = tasks.filter((task) => task.status === "todo").map((task) => task.id);
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
      setTaskErrors((c) => ({ ...c, [task.id]: apiError(caught, "overview.todos.updateFailed") }));
    } finally {
      setSaving((s) => s.filter((id) => id !== task.id));
    }
  }

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const assigneeLabel = (task: Task) => (saving.includes(task.id) ? t("state.saving") : task.assignee || t("state.unassigned"));

  return (
    <>
      <PageHead
        eyebrow={<>{(data?.club.name ?? t("overview.fallbackClub")).toUpperCase()} <span>/</span> {t("overview.kicker")}</>}
        title={t("overview.titleLine1")}
        titleAccent={t("overview.titleLine2")}
        description={t("overview.lede")}
        actions={can("members:create") ? <Button variant="primary" onClick={() => router.push("/app/members?add=1")}><Icon name="plus" size={18} />{t("overview.addMember")}</Button> : null}
      />

      {dashboard.error ? <ErrorState error={dashboard.error} onRetry={dashboard.reload} title={t("overview.loadErrorTitle")} /> : null}
      {dashboard.loading && !data ? <WorkspaceMainSkeleton /> : null}

      {data ? (
        <>
          <section className="metrics-grid" aria-label={t("overview.keyFigures")}>
            <Stat label={t("overview.metrics.totalMembers")} value={data.metrics.members} hint={t("overview.metrics.activeMemberships", { count: data.metrics.activeMembers })} tone="blue" icon="people" />
            <Stat label={t("overview.metrics.upcomingEvents")} value={String(data.metrics.upcomingEvents).padStart(2, "0")} hint={t("overview.metrics.upcomingHint")} tone="accent" icon="calendar" />
            <Stat label={t("overview.metrics.openTasks")} value={String(openTasks).padStart(2, "0")} hint={t("overview.metrics.tasksCompleted", { count: doneTasks })} tone="green" icon="check" />
            {data.access.finance
              ? <Stat label={t("overview.metrics.clubBalance")} value={fmt.currency(data.metrics.balancePaise)} hint={t("overview.metrics.balanceHint")} tone="dark" icon="wallet" />
              : <Stat label={t("overview.metrics.announcements")} value={String(data.announcements.length).padStart(2, "0")} hint={t("overview.metrics.announcementsHint")} tone="dark" icon="megaphone" />}
          </section>

          <div className="overview-grid">
            <section className="panel events-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">{t("overview.calendar.kicker")}</div><h2>{t("overview.calendar.title")}</h2></div>
                <TextLink href="/app/events">{t("overview.calendar.allEvents")}</TextLink>
              </div>
              {data.events.length ? (
                <div className="event-list">
                  {data.events.slice(0, 4).map((event, index) => (
                    <Link key={event.id} href={`/app/events/${event.id}`} className="event-row">
                      <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}><span>{fmt.month(event.startsAt).toUpperCase()}</span><strong>{fmt.day(event.startsAt)}</strong></div>
                      <div className="event-info">
                        <h3>{event.title}</h3>
                        <p>{event.venue}</p>
                        <div className="event-capacity">
                          <div className="capacity-track"><span style={{ width: `${event.capacity ? Math.min(100, (event.registered / event.capacity) * 100) : 0}%` }} /></div>
                          <span>{t("overview.calendar.registered", { registered: event.registered, capacity: event.capacity })}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : <EmptyState title={t("overview.calendar.emptyTitle")} icon="calendar">{can("events:write") ? t("overview.calendar.emptyOfficer") : t("overview.calendar.emptyMember")}</EmptyState>}
              <div className="panel-footnote"><span className="tiny-dot" />{t("overview.calendar.footnote")}</div>
            </section>

            <section className="panel tasks-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">{t("overview.todos.kicker")}</div><h2>{t("overview.todos.title")}</h2></div>
                <TextLink href="/app/tasks">{t("overview.todos.viewAll")}</TextLink>
              </div>
              {tasks.length ? (
                <div className="dashboard-kanban" aria-label={t("overview.todos.ariaLabel")}>
                  {STATUSES.map((status) => {
                    const column = tasks.filter((task) => task.status === status).sort((a, b) => status !== "todo" ? 0 : (todoOrder.indexOf(a.id) === -1 ? Number.MAX_SAFE_INTEGER : todoOrder.indexOf(a.id)) - (todoOrder.indexOf(b.id) === -1 ? Number.MAX_SAFE_INTEGER : todoOrder.indexOf(b.id)));
                    return (
                      <section key={status} className={`dashboard-kanban-column ${status} ${dragged ? "is-drop-target" : ""}`.trim()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragged; const task = tasks.find((item) => item.id === id); setDragged(null); if (task) void move(task, status); }}>
                        <header><span className={`status-dot ${status}`} aria-hidden="true" /><span>{t(`status.${status}`)}</span><b>{column.length}</b></header>
                        <div className="dashboard-kanban-cards">
                          {column.length ? status === "todo" ? (
                            <ReorderList items={column} getId={(task) => task.id} getLabel={(task) => task.title} onReorder={(next) => setTodoOrder(next.map((task) => task.id))} onLongPress={(task) => void move(task, "done")} onExternalDragStart={(task) => setDragged(task.id)} onExternalDragEnd={() => setDragged(null)} label={t("status.todo")} disabled={!can("tasks:write")} itemClassName="dashboard-reorder-item" showGrip={false}>
                              {(task) => (
                                <div>
                                  <div className={`dashboard-task-card ${saving.includes(task.id) ? "completing" : ""}`.trim()} title={t("overview.todos.dragHint")}>
                                    <span className="dashboard-task-title">{task.title}</span>
                                    <span className="dashboard-task-assignee">{assigneeLabel(task)}</span>
                                  </div>
                                  {taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}
                                </div>
                              )}
                            </ReorderList>
                          ) : column.map((task) => (
                            <div key={task.id}>
                              <button type="button" disabled={saving.includes(task.id) || !canMove(task)} draggable={!saving.includes(task.id) && canMove(task)} className={`dashboard-task-card ${task.status === "done" ? "completed" : ""} ${saving.includes(task.id) ? "completing" : ""}`.trim()} onClick={() => void move(task, task.status === "done" ? "todo" : "done")} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", task.id); setDragged(task.id); }} onDragEnd={() => setDragged(null)} title={t("overview.todos.toggleHint")}>
                                <span className="dashboard-task-title">{task.title}</span>
                                <span className="dashboard-task-assignee">{assigneeLabel(task)}</span>
                              </button>
                              {taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}
                            </div>
                          )) : <p className="dashboard-kanban-empty">{t("overview.todos.columnEmpty")}</p>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : <EmptyState title={t("overview.todos.emptyTitle")} icon="check">{can("tasks:write") ? t("overview.todos.emptyOfficer") : t("overview.todos.emptyMember")}</EmptyState>}
            </section>
          </div>

          <div className="overview-bottom">
            <section className="panel members-panel">
              <div className="panel-heading">
                <div><div className="eyebrow">{t("overview.directory.kicker")}</div><h2>{t("overview.directory.title")}</h2></div>
                {data.access.members ? <TextLink href="/app/members">{t("overview.directory.allMembers")}</TextLink> : null}
              </div>
              {data.access.members && data.members.length ? (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th scope="col">{t("col.member")}</th><th scope="col">{t("col.joined")}</th><th scope="col">{t("overview.directory.colDues")}</th><th scope="col">{t("col.expires")}</th></tr></thead>
                    <tbody>
                      {data.members.slice(0, 6).map((member) => (
                        <tr key={member.id}>
                          <td><Link href={`/app/members/${member.id}`}><Person name={member.name} sub={member.email} /></Link></td>
                          <td>{fmt.date(member.joinedAt)}</td>
                          <td><span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>{member.duesStatus === "paid" ? t("status.paid") : t("status.unpaid")}</span></td>
                          <td>{member.expiresOn ? fmt.date(member.expiresOn) : t("state.notSet")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState title={data.access.members ? t("overview.directory.emptyTitle") : t("overview.directory.officerOnlyTitle")} icon="people">{data.access.members ? t("overview.directory.emptyBody") : t("overview.directory.officerOnlyBody")}</EmptyState>}
            </section>

            {data.announcements.length ? (
              <article className="notice-card">
                <span className="notice-icon"><Icon name="megaphone" size={20} /></span>
                <div className="eyebrow">{t("overview.notice.kicker")}</div>
                <h2>{data.announcements[0].title}</h2>
                <p>{data.announcements[0].body.length > 160 ? `${data.announcements[0].body.slice(0, 160)}…` : data.announcements[0].body}</p>
                <span className="notice-date">{fmt.date(data.announcements[0].publishedAt)}</span>
                <TextLink href="/app/announcements">{t("overview.notice.read")}</TextLink>
              </article>
            ) : (
              <Card kicker={t("overview.notice.kicker")} title={t("overview.notice.emptyTitle")}>
                <p className="mx-muted mx-small">{can("announcements:write") ? t("overview.notice.emptyOfficer") : t("overview.notice.emptyMember")}</p>
              </Card>
            )}
          </div>

          <PreviewNote>{t("overview.previewNote")}</PreviewNote>
        </>
      ) : null}
    </>
  );
}
