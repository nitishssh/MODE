"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { EventDetails, Member, TaskDetails } from "@/lib/contracts";
import { api, describeError, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { date, fromLocalInput, toLocalInput } from "../../_lib/format";
import { Alert, Button, EmptyState, ErrorState, FormPanel, Loading, PageHead, PreviewNote } from "../../_components/ui";
import { Icon } from "../../_components/icons";

/* Azman's TaskBoard: filter toolbar, inline create panel, three kanban columns
 * of TaskCards with status chips and an inline edit form. */

type Status = TaskDetails["status"];
const ORDER: Status[] = ["todo", "in_progress", "done"];
const LABELS: Record<Status, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

const initials = (name: string) => name.split(" ").slice(0, 2).map((part) => part[0] ?? "").join("");

export default function TasksPage() {
  const { user, can } = useSession();
  const canWrite = can("tasks:write");
  const canReadMembers = can("members:read");

  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [mine, setMine] = useState(false);

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
      const updated = await api.post<TaskDetails>(`/api/tasks/${encodeURIComponent(id)}/status`, { status });
      tasks.setData((current) => (current ?? []).map((t) => (t.id === updated.id ? updated : t)));
    });
    setUpdating(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) { setCreateError("Give the task a title."); return; }
    const dueRaw = String(fd.get("dueAt") ?? "");
    const dueAt = dueRaw ? fromLocalInput(dueRaw) : null;
    if (dueRaw && !dueAt) { setCreateError("Enter a valid deadline."); return; }
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
      action.setNotice("Task created.");
    } catch (caught) {
      setCreateError(describeError(caught, "Could not create the task."));
    } finally {
      setCreating(false);
    }
  }

  const memberOptions = members.data?.members ?? [];
  const eventOptions = events.data?.events ?? [];

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> TASKS</>}
        title="Tasks"
        description="Who is doing the work, what is due, and what still needs to get done."
      />

      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}

      <div className="task-toolbar">
        <div className="task-filters">
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | Status)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {ORDER.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
          {canReadMembers ? (
            <select className="filter-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Filter by assignee">
              <option value="">All assignees</option>
              {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : null}
          <select className="filter-select" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event">
            <option value="">All events</option>
            {eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
          <label className="filter-toggle"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Overdue only</label>
          <label className="filter-toggle"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Assigned to me</label>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={() => { setShowForm(true); setCreateError(""); action.clear(); }}><Icon name="plus" size={16} />New task</Button>
        ) : null}
      </div>

      {showForm && canWrite ? (
        <FormPanel title="New task" description="Give it an owner and a deadline so it does not get lost." onClose={() => setShowForm(false)}>
          <form onSubmit={create}>
            <div className="task-form-grid">
              <label>Title<input name="title" placeholder="What needs doing" maxLength={200} required disabled={creating} autoFocus /></label>
              <label>Description<textarea name="description" placeholder="Any details the owner needs" maxLength={2000} rows={2} disabled={creating} /></label>
              {canReadMembers ? (
                <label>Assignee<select name="assigneeId" disabled={creating}><option value="">Unassigned</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              ) : null}
              <label>Event<select name="eventId" disabled={creating}><option value="">No event</option>{eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
              <label>Due date<input name="dueAt" type="datetime-local" disabled={creating} /></label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={creating}>{creating ? "Creating…" : "Create task"}</button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)} disabled={creating}>Cancel</button>
            </div>
            {createError ? <p className="form-error" role="alert">{createError}</p> : null}
          </form>
        </FormPanel>
      ) : null}

      {tasks.error ? <ErrorState error={tasks.error} onRetry={tasks.reload} title="Tasks could not load" /> : tasks.loading && !tasks.data ? <Loading label="Loading tasks…" /> : !list.length ? (
        <section className="panel">
          <EmptyState title="No tasks here" icon="check">{mine ? "Nothing is assigned to you with these filters." : canWrite ? "Create the first task to get the team moving." : "Nothing matches these filters."}</EmptyState>
        </section>
      ) : (
        <div className="kanban-grid">
          {ORDER.map((status) => {
            const column = list.filter((t) => t.status === status);
            return (
              <section key={status} className="kanban-column" aria-label={LABELS[status]}>
                <h2><span className={`status-dot ${status}`} aria-hidden="true" />{LABELS[status]}<span className="column-count">{column.length}</span></h2>
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
                    onEditDone={(updated) => { tasks.setData((current) => (current ?? []).map((t) => (t.id === updated.id ? updated : t))); setEditingId(null); }}
                  />
                )) : <p className="column-empty">Nothing here yet.</p>}
              </section>
            );
          })}
        </div>
      )}

      <PreviewNote>Only the assigned member or an organizer can move a task. Deadlines are shown in club time.</PreviewNote>
    </>
  );
}

function TaskCard({ task, canEdit, canChangeStatus, members, events, updating, onStatusChange, showEdit, onEdit, onEditDone }: {
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
}) {
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
      setSaveError(describeError(caught, "Could not update the task."));
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
          {isOverdue ? <span className="badge red task-overdue-badge" title="Overdue"><Icon name="alert" size={10} />Overdue</span> : null}
          <button type="button" className="icon-button" aria-label={showEdit ? "Close edit" : "Edit task"} disabled={!canEdit} onClick={onEdit}>
            <Icon name={showEdit ? "close" : "chevron"} size={14} />
          </button>
        </div>
      </div>
      {task.description ? <p className="task-desc">{task.description}</p> : null}
      <div className="task-meta">
        <div className="person">
          <span className="avatar small">{task.assignee ? initials(task.assignee) : "?"}</span>
          <span className="task-assignee">{task.assignee || "Unassigned"}</span>
        </div>
        {task.dueAt ? <span className={`task-due ${isOverdue ? "overdue-text" : ""}`.trim()}><Icon name="clock" size={12} />{date(task.dueAt)}</span> : null}
      </div>
      {task.eventTitle ? <div className="task-event-tag"><Icon name="calendar" size={11} />{task.eventTitle}</div> : null}
      <div className="task-status-row">
        <span className="task-status-label">Move to:</span>
        {ORDER.filter((s) => s !== task.status).map((s) => (
          <button key={s} type="button" className={`status-chip ${s}`} disabled={updating || !canChangeStatus} onClick={() => onStatusChange(task.id, s)}>{LABELS[s]}</button>
        ))}
      </div>
      {showEdit ? (
        <form className="task-edit-form" onSubmit={handleEdit}>
          <label>Title<input name="title" defaultValue={task.title} maxLength={200} disabled={saving} /></label>
          <label>Description<textarea name="description" defaultValue={task.description ?? ""} maxLength={2000} rows={2} disabled={saving} /></label>
          {members.length ? (
            <label>Assignee<select name="assigneeId" defaultValue={task.assigneeId ?? ""} disabled={saving}><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          ) : null}
          <label>Event<select name="eventId" defaultValue={task.eventId ?? ""} disabled={saving}><option value="">No event</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}</select></label>
          <label>Due date<input name="dueAt" type="datetime-local" defaultValue={toLocalInput(task.dueAt)} disabled={saving} /></label>
          <button type="submit" className="button primary" disabled={saving} style={{ marginTop: 10 }}>{saving ? "Saving…" : "Save changes"}</button>
          {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        </form>
      ) : null}
    </article>
  );
}
