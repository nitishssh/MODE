"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { EventDetails, Member, TaskDetails } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { fromLocalInput, relative, toLocalInput } from "../../_lib/format";
import { Alert, Button, EmptyState, ErrorState, Modal, PageHead, Segmented, SelectField, Skeleton, Stat, StatusBadge, TextField, TextareaField } from "../../_components/ui";
import { Icon } from "../../_components/icons";

type Status = TaskDetails["status"];
const ORDER: Status[] = ["todo", "in_progress", "done"];
const LABELS: Record<Status, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

interface FormState { title: string; description: string; assigneeId: string; eventId: string; dueAt: string }
const EMPTY: FormState = { title: "", description: "", assigneeId: "", eventId: "", dueAt: "" };

function truncate(text: string | null, max = 120): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function TasksPage() {
  const { user, can } = useSession();
  const canWrite = can("tasks:write");
  const canReadMembers = can("members:read");

  const [scope, setScope] = useState<"mine" | "all">(canWrite ? "all" : "mine");
  const [eventFilter, setEventFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (scope === "mine") params.set("mine", "true");
    if (eventFilter) params.set("eventId", eventFilter);
    if (overdueOnly) params.set("overdue", "true");
    const qs = params.toString();
    return `/api/tasks${qs ? `?${qs}` : ""}`;
  }, [scope, eventFilter, overdueOnly]);

  const tasks = useLoad(() => api.get<TaskDetails[]>(query), [query]);
  const events = useLoad(() => api.get<{ events: EventDetails[] }>("/api/events"));
  const members = useLoad(() => (canReadMembers ? api.get<{ members: Member[] }>("/api/members") : Promise.resolve({ members: [] as Member[] })), [canReadMembers]);

  const action = useAction();
  const [modal, setModal] = useState<{ mode: "new" } | { mode: "edit"; task: TaskDetails } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState("");

  const list = tasks.data ?? [];
  const open = list.filter((t) => t.status !== "done").length;
  const overdue = list.filter((t) => t.overdue && t.status !== "done").length;
  const done = list.filter((t) => t.status === "done").length;

  const canMove = useCallback((task: TaskDetails) => canWrite || (user !== null && task.assigneeId === user.id), [canWrite, user]);

  async function move(task: TaskDetails, direction: 1 | -1) {
    const index = ORDER.indexOf(task.status);
    const next = ORDER[index + direction];
    if (!next) return;
    await action.run(`move:${task.id}`, async () => {
      const updated = await api.post<TaskDetails>(`/api/tasks/${encodeURIComponent(task.id)}/status`, { status: next });
      tasks.setData((current) => (current ?? []).map((t) => (t.id === updated.id ? updated : t)));
    });
  }

  function openNew() {
    setForm(EMPTY);
    setFormError("");
    setModal({ mode: "new" });
  }

  function openEdit(task: TaskDetails) {
    setForm({ title: task.title, description: task.description ?? "", assigneeId: task.assigneeId ?? "", eventId: task.eventId ?? "", dueAt: toLocalInput(task.dueAt) });
    setFormError("");
    setModal({ mode: "edit", task });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const title = form.title.trim();
    if (!title) { setFormError("Give the task a title."); return; }
    const dueAt = form.dueAt ? fromLocalInput(form.dueAt) : null;
    if (form.dueAt && !dueAt) { setFormError("Enter a valid deadline."); return; }
    setFormError("");
    const ok = await action.run("save", async () => {
      if (modal.mode === "new") {
        const body: Record<string, unknown> = { title };
        if (form.description.trim()) body.description = form.description.trim();
        if (form.assigneeId) body.assigneeId = form.assigneeId;
        if (form.eventId) body.eventId = form.eventId;
        if (dueAt) body.dueAt = dueAt;
        const created = await api.post<TaskDetails>("/api/tasks", body);
        tasks.setData((current) => [created, ...(current ?? [])]);
        return "Task created.";
      }
      const body = {
        title,
        description: form.description.trim() || null,
        assigneeId: form.assigneeId || null,
        eventId: form.eventId || null,
        dueAt,
      };
      const updated = await api.patch<TaskDetails>(`/api/tasks/${encodeURIComponent(modal.task.id)}`, body);
      tasks.setData((current) => (current ?? []).map((t) => (t.id === updated.id ? updated : t)));
      return "Task updated.";
    });
    if (ok) setModal(null);
  }

  const memberOptions = members.data?.members ?? [];
  const eventOptions = events.data?.events ?? [];

  return (
    <>
      <PageHead
        eyebrow="Volunteers"
        title="Tasks"
        description={canWrite ? "Assign work, set deadlines and watch it move to done." : "Work assigned to you and across the club."}
        actions={canWrite ? <Button variant="primary" onClick={openNew}><Icon.plus />New task</Button> : null}
      />

      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}

      <div className="mx-grid mx-grid-3 mx-mb">
        <Stat label="Open" value={tasks.data ? open : "—"} tone="blue" />
        <Stat label="Overdue" value={tasks.data ? overdue : "—"} tone={overdue ? "accent" : undefined} />
        <Stat label="Done" value={tasks.data ? done : "—"} tone="green" />
      </div>

      <div className="mx-toolbar">
        <Segmented value={scope} onChange={setScope} items={[{ value: "mine", label: "Mine" }, { value: "all", label: "All" }]} />
        <select className="mx-select sm" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} aria-label="Filter by event">
          <option value="">All events</option>
          {eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
        <label className="mx-check"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Overdue only</label>
        <Button size="sm" variant="ghost" className="mx-right" onClick={() => void tasks.reload()}><Icon.refresh />Refresh</Button>
      </div>

      {tasks.error ? <ErrorState error={tasks.error} onRetry={tasks.reload} /> : tasks.loading && !tasks.data ? <Skeleton rows={6} /> : !list.length ? (
        <EmptyState title="No tasks here" action={canWrite ? <Button onClick={openNew}><Icon.plus />Create the first task</Button> : undefined}>
          {scope === "mine" ? "Nothing is assigned to you with these filters." : "Nothing matches these filters."}
        </EmptyState>
      ) : (
        <div className="mx-board">
          {ORDER.map((status) => {
            const column = list.filter((t) => t.status === status);
            return (
              <section key={status} className="mx-column" aria-label={LABELS[status]}>
                <div className="mx-column-head"><span>{LABELS[status]}</span><span>{column.length}</span></div>
                {column.length === 0 ? <p className="mx-muted mx-small" style={{ padding: "8px 6px" }}>Empty</p> : null}
                {column.map((task) => {
                  const idx = ORDER.indexOf(task.status);
                  const movable = canMove(task);
                  const busy = action.busy === `move:${task.id}`;
                  return (
                    <article key={task.id} className={`mx-task ${task.overdue && task.status !== "done" ? "overdue" : ""}`.trim()}>
                      <div className="mx-between" style={{ alignItems: "flex-start" }}>
                        <strong>{task.title}</strong>
                        {task.overdue && task.status !== "done" ? <StatusBadge status="rejected" label="Overdue" /> : null}
                      </div>
                      {task.description ? <small>{truncate(task.description)}</small> : null}
                      <small>{task.assignee ?? "Unassigned"}{task.eventTitle ? ` · ${task.eventTitle}` : ""}</small>
                      <small style={task.overdue && task.status !== "done" ? { color: "var(--mx-red)", fontWeight: 600 } : undefined}>
                        {task.dueAt ? `Due ${relative(task.dueAt)}` : "No deadline"}
                      </small>
                      <div className="mx-row" style={{ marginTop: 8 }}>
                        <Button size="sm" disabled={!movable || idx === 0} loading={busy} onClick={() => void move(task, -1)} aria-label={`Move "${task.title}" back`}><Icon.back /></Button>
                        <Button size="sm" disabled={!movable || idx === ORDER.length - 1} loading={busy} onClick={() => void move(task, 1)} aria-label={`Move "${task.title}" forward`}><Icon.arrow /></Button>
                        {canWrite ? <Button size="sm" variant="ghost" className="mx-right" onClick={() => openEdit(task)}><Icon.edit />Edit</Button> : null}
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <Modal open={modal !== null} title={modal?.mode === "edit" ? "Edit task" : "New task"} onClose={() => setModal(null)}>
        <form className="mx-form" onSubmit={submit} noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <TextField label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} required autoFocus />
          <TextareaField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={2000} />
          <div className="mx-form-row">
            {canReadMembers ? (
              <SelectField label="Assignee" value={form.assigneeId} onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}>
                <option value="">Unassigned</option>
                {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </SelectField>
            ) : null}
            <SelectField label="Event" value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}>
              <option value="">No event</option>
              {eventOptions.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </SelectField>
          </div>
          <TextField label="Deadline" type="datetime-local" value={form.dueAt} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} hint="Leave empty for no deadline." />
          <div className="mx-form-actions">
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={action.busy === "save"}>{modal?.mode === "edit" ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
