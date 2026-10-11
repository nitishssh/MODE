"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { EventDetails, Member, TaskDetails } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { useT, type AppI18n } from "../../_lib/i18n";
import { fromLocalInput, toLocalInput } from "../../_lib/format";
import { Alert, Button, EmptyState, ErrorState, FormPanel, Loading, PageHead, PreviewNote } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's TaskBoard: filter toolbar, inline create panel, three kanban columns
 * of TaskCards with status chips and an inline edit form. */

type Status = TaskDetails["status"];
const ORDER: Status[] = ["todo", "in_progress", "done"];

const initials = (name: string) => name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("");

export default function TasksPage() {
  const { user, can } = useSession();
  const { t, apiError } = useT();
  const canWrite = can("tasks:write");
  const canReadMembers = can("members:read");

  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  // People without tasks:write are here for their own assignments; officers start with the whole board.
  const [mine, setMine] = useState(!canWrite);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);
    if (eventFilter) params.set("eventId", eventFilter);
    if (overdueOnly) params.set("overdue", "true");
    if (mine) params.set("mine", "true");
    const qs = params.toString();
    return `/api/tasks${qs ? `?${qs}` : ""}`;
  }, [statusFilter, assigneeFilter, eventFilter, overdueOnly, mine]);

  const tasks = useLoad(() => api.get<TaskDetails[]>(query), [query]);
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));
  const members = useLoad(() => (canReadMembers ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [canReadMembers]);

  const action = useAction();
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const list = tasks.data ?? [];
  const canMove = useCallback((task: TaskDetails) => canWrite || (user !== null && task.assigneeId === user.id), [canWrite, user]);

  async function changeStatus(id: string, status: Status) {
    setUpdating(id);
    await action.run(`move:${id}`, async () => {
      try {
        const updated = await api.post<TaskDetails>(`/api/tasks/${encodeURIComponent(id)}/status`, { status });
        tasks.setData((current) => (current ?? []).map((task) => (task.id === updated.id ? updated : task)));
      } catch (caught) {
        throw new Error(apiError(caught));
      }
    });
    setUpdating(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) { setCreateError(t("tasks.error.titleRequired")); return; }
    const dueRaw = String(fd.get("dueAt") ?? "");
    const dueAt = dueRaw ? fromLocalInput(dueRaw) : null;
    if (dueRaw && !dueAt) { setCreateError(t("tasks.error.deadlineInvalid")); return; }
    setCreating(true);
    setCreateError("");
    try {
      const body: Record<string, unknown> = { title };
      const description = String(fd.get("description") ?? "").trim();
      if (description) body.description = description;
      const assigneeId = String(fd.get("assigneeId") ?? "");
      if (assigneeId) body.assigneeId = assigneeId;
      const eventId = String(fd.get("eventId") ?? "");
      if (eventId) body.eventId = eventId;
      if (dueAt) body.dueAt = dueAt;
      const created = await api.post<TaskDetails>("/api/tasks", body);
      tasks.setData((current) => [created, ...(current ?? [])]);
      form.reset();
      setShowForm(false);
      action.setNotice(t("tasks.created"));
    } catch (caught) {
      setCreateError(apiError(caught, "tasks.error.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  const memberOptions = members.data?.members ?? [];
  const eventOptions = events.data?.events ?? [];

  return (
    <>
      <PageHead
        eyebrow={<>{t("tasks.eyebrowClub")} <span>/</span> {t("tasks.eyebrow")}</>}
        title={t("tasks.title")}
        description={t("tasks.description")}
      />

      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}

      <div className="task-toolbar">
        <div className="task-filters">
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | Status)} aria-label={t("tasks.toolbar.filterStatus")}>
            <option value="">{t("tasks.toolbar.allStatuses")}</option>
            {ORDER.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          {canReadMembers ? (
            <select className="filter-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label={t("tasks.toolbar.filterAssignee")}>
              <option value="">{t("tasks.toolbar.allAssignees")}</option>
              {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : null}
          <select className="filter-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label={t("tasks.toolbar.filterEvent")}>
            <option value="">{t("tasks.toolbar.allEvents")}</option>
            {eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
          <label className="filter-toggle"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />{t("tasks.toolbar.overdueOnly")}</label>
          <label className="filter-toggle"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t("tasks.toolbar.assignedToMe")}</label>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={() => { setShowForm(true); setCreateError(""); action.clear(); }}><Icon name="plus" size={16} />{t("tasks.newTask")}</Button>
        ) : null}
      </div>

      {showForm && canWrite ? (
        <FormPanel title={t("tasks.newTask")} description={t("tasks.form.description")} onClose={() => setShowForm(false)}>
          <form onSubmit={create}>
            <div className="task-form-grid">
              <label>{t("col.title")}<input name="title" placeholder={t("tasks.form.titlePlaceholder")} maxLength={200} required disabled={creating} autoFocus /></label>
              <label>{t("col.description")}<textarea name="description" placeholder={t("tasks.form.descriptionPlaceholder")} maxLength={2000} rows={2} disabled={creating} /></label>
              {canReadMembers ? (
                <label>{t("tasks.form.assignee")}<select name="assigneeId" disabled={creating}><option value="">{t("state.unassigned")}</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              ) : null}
              <label>{t("col.event")}<select name="eventId" disabled={creating}><option value="">{t("tasks.form.noEvent")}</option>{eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
              <label>{t("tasks.form.dueDate")}<input name="dueAt" type="datetime-local" disabled={creating} /></label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={creating}>{creating ? t("tasks.form.creating") : t("tasks.form.createTask")}</button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={creating}>{t("action.cancel")}</button>
            </div>
            {createError ? <p className="form-error" role="alert">{createError}</p> : null}
          </form>
        </FormPanel>
      ) : null}

      {tasks.error ? <ErrorState error={tasks.error} onRetry={tasks.reload} title={t("tasks.errorTitle")} /> : tasks.loading && !tasks.data ? <Loading label={t("tasks.loading")} /> : !list.length ? (
        <section className="panel">
          <EmptyState title={t("tasks.emptyTitle")} icon="check">{mine ? t("tasks.emptyMine") : canWrite ? t("tasks.emptyCreate") : t("tasks.emptyFilters")}</EmptyState>
        </section>
      ) : (
        <div className="kanban-grid">
          {ORDER.map((status) => {
            const column = list.filter((task) => task.status === status);
            return (
              <section key={status} className="kanban-column" aria-label={t(`status.${status}`)}>
                <h2><span className={`status-dot ${status}`} aria-hidden="true" />{t(`status.${status}`)}<span className="column-count">{column.length}</span></h2>
                {column.length ? column.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canWrite}
                    canChangeStatus={canMove(task)}
                    members={memberOptions}
                    events={eventOptions}
                    updating={updating === task.id}
                    onStatusChange={changeStatus}
                    showEdit={editingId === task.id}
                    onEdit={() => setEditingId((current) => (current === task.id ? null : task.id))}
                    onEditDone={(updated) => { tasks.setData((current) => (current ?? []).map((item) => (item.id === updated.id ? updated : item))); setEditingId(null); }}
                    i18n={{ t, apiError }}
                  />
                )) : <p className="column-empty">{t("state.empty")}</p>}
              </section>
            );
          })}
        </div>
      )}

      <PreviewNote>{t("tasks.note")}</PreviewNote>
    </>
  );
}

function TaskCard({ task, canEdit, canChangeStatus, members, events, updating, onStatusChange, showEdit, onEdit, onEditDone, i18n }: {
  task: TaskDetails;
  canEdit: boolean;
  canChangeStatus: boolean;
  members: Member[];
  events: EventDetails[];
  updating: boolean;
  onStatusChange: (id: string, status: Status) => void;
  showEdit: boolean;
  onEdit: () => void;
  onEditDone: (updated: TaskDetails) => void;
  i18n: Pick<AppI18n, "t" | "apiError">;
}) {
  const { t, apiError } = i18n;
  const { fmt } = useT();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string | null | undefined> = {};
      const title = String(fd.get("title") ?? "").trim();
      if (title) body.title = title;
      const desc = String(fd.get("description") ?? "").trim();
      body.description = desc || null;
      const assigneeId = String(fd.get("assigneeId") ?? "");
      body.assigneeId = assigneeId || null;
      const eventId = String(fd.get("eventId") ?? "");
      body.eventId = eventId || null;
      const dueRaw = String(fd.get("dueAt") ?? "");
      body.dueAt = dueRaw ? fromLocalInput(dueRaw) : null;
      const updated = await api.patch<TaskDetails>(`/api/tasks/${encodeURIComponent(task.id)}`, body);
      onEditDone(updated);
    } catch (caught) {
      setSaveError(apiError(caught, "tasks.error.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  const isOverdue = task.overdue && task.status !== "done";
  return (
    <article className={`task-card ${isOverdue ? "task-overdue" : ""}`.trim()}>
      <div className="task-card-header">
        <h3>{task.title}</h3>
        <div className="task-card-actions">
          {isOverdue ? <span className="badge red task-overdue-badge" title={t("tasks.card.overdue")}><Icon name="alert" size={10} />{t("tasks.card.overdue")}</span> : null}
          <button type="button" className="icon-button" aria-label={showEdit ? t("tasks.card.closeEdit") : t("tasks.card.edit")} disabled={!canEdit} onClick={onEdit}>
            <Icon name={showEdit ? "close" : "chevron"} size={14} />
          </button>
        </div>
      </div>
      {task.description ? <p className="task-desc">{task.description}</p> : null}
      <div className="task-meta">
        <div className="person">
          <span className="avatar small">{task.assignee ? initials(task.assignee) : "?"}</span>
          <span className="task-assignee">{task.assignee || t("state.unassigned")}</span>
        </div>
        {task.dueAt ? <span className={`task-due ${isOverdue ? "overdue-text" : ""}`.trim()}><Icon name="clock" size={12} />{fmt.date(task.dueAt)}</span> : null}
      </div>
      {task.eventTitle ? <div className="task-event-tag"><Icon name="calendar" size={11} />{task.eventTitle}</div> : null}
      <div className="task-status-row">
        <span className="task-status-label">{t("tasks.card.moveTo")}</span>
        {ORDER.filter((s) => s !== task.status).map((s) => (
          <button key={s} type="button" className={`status-chip ${s}`} disabled={updating || !canChangeStatus} onClick={() => onStatusChange(task.id, s)}>{t(`status.${s}`)}</button>
        ))}
      </div>
      {showEdit ? (
        <form className="task-edit-form" onSubmit={handleEdit}>
          <label>{t("col.title")}<input name="title" defaultValue={task.title} maxLength={200} disabled={saving} /></label>
          <label>{t("col.description")}<textarea name="description" defaultValue={task.description ?? ""} maxLength={2000} rows={2} disabled={saving} /></label>
          {members.length ? (
            <label>{t("tasks.form.assignee")}<select name="assigneeId" defaultValue={task.assigneeId ?? ""} disabled={saving}><option value="">{t("state.unassigned")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          ) : null}
          <label>{t("col.event")}<select name="eventId" defaultValue={task.eventId ?? ""} disabled={saving}><option value="">{t("tasks.form.noEvent")}</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
          <label>{t("tasks.form.dueDate")}<input name="dueAt" type="datetime-local" defaultValue={toLocalInput(task.dueAt)} disabled={saving} /></label>
          <button type="submit" className="button primary" disabled={saving} style={{ marginTop: 10 }}>{saving ? t("state.saving") : t("tasks.form.saveChanges")}</button>
          {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        </form>
      ) : null}
    </article>
  );
}
