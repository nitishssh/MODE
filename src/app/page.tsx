"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import { WorkspaceMainSkeleton } from "./skeleton";
import { localDateTimeValue } from "@/lib/local-datetime";
import { MAX_RECEIPT_SIZE_BYTES } from "@/lib/contracts";
import type {
  Dashboard,
  Event,
  WorkspaceEventReport as EventReport,
  Expense,
  ExpenseLedgerEntry as LedgerEntry,
  SessionUser,
  LedgerSummary,
  LedgerSource,
  Member,
  TaskDetails,
} from "@/lib/contracts";

// ── Types ──────────────────────────────────────────────────────────────────────

type Section =
  | "Overview"
  | "Members"
  | "Events"
  | "Announcements"
  | "Merchandise"
  | "Tasks"
  | "My Expenses"
  | "Treasury";

const dashboardTaskStatuses: TaskDetails["status"][] = ["todo", "in_progress", "done"];

type IconName =
  | "grid"
  | "people"
  | "calendar"
  | "megaphone"
  | "bag"
  | "check"
  | "wallet"
  | "arrow"
  | "plus"
  | "close"
  | "chevron"
  | "filter"
  | "download"
  | "upload"
  | "clock"
  | "alert"
  | "receipt"
  | "coin"
  | "sun"
  | "moon";

const navigation: { label: Section; icon: IconName }[] = [
  { label: "Overview", icon: "grid" },
  { label: "Members", icon: "people" },
  { label: "Events", icon: "calendar" },
  { label: "Announcements", icon: "megaphone" },
  { label: "Merchandise", icon: "bag" },
  { label: "Tasks", icon: "check" },
  { label: "My Expenses", icon: "receipt" },
  { label: "Treasury", icon: "wallet" },
];

const descriptions: Record<Section, string> = {
  Overview: "A little less admin. A lot more campus life.",
  Members: "The people who make your community happen.",
  Events: "Bring people together, from the first ticket to the last check-in.",
  Announcements: "Give every update a home your members can find.",
  Merchandise: "Club essentials, with orders and stock in one place.",
  Tasks: "Who is doing the work, what is due, and what still needs to get done.",
  "My Expenses": "Submit expense requests and track their approval status.",
  Treasury: "A clear view of what comes in, what goes out, and what is owed.",
};

// ── Formatters ─────────────────────────────────────────────────────────────────

const currency = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

const date = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

const day = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));

const month = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

const taskLabel = { todo: "To do", in_progress: "In progress", done: "Done" };

const expenseStatusLabel: Record<string, string> = {
  submitted: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const expenseStatusClass: Record<string, string> = {
  submitted: "amber",
  approved: "purple",
  rejected: "red",
  paid: "green",
};

// ── Icon Component ─────────────────────────────────────────────────────────────

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18m-14 5h3" />
      </>
    ),
    megaphone: <path d="M3 10v5h5l11 5V4L8 10H3Zm5 5 2 6h3l-2-5M22 9v6" />,
    bag: (
      <>
        <path d="M5 8h14l2 13H3L5 8Z" />
        <path d="M8 9V6a4 4 0 0 1 8 0v3" />
      </>
    ),
    check: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    wallet: <path d="M21 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V7M21 13h-5v4h5" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    filter: (
      <>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    alert: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    receipt: (
      <>
        <polyline points="8 3 4 3 4 21 20 21 20 3 16 3" />
        <rect x="8" y="3" width="8" height="4" rx="1" ry="1" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </>
    ),
    coin: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v2m0 8v2M8 12h8" />
        <path d="M14.5 9.5A2.5 2.5 0 0 0 12 7a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 2.5-2.5" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────────

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="grid" size={24} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <div className="preview-note">
      <span className="badge neutral">Starter preview</span>
      <p>{children}</p>
    </div>
  );
}

function MemberTable({ members }: { members: Member[] }) {
  if (!members.length)
    return (
      <Empty title="Your community starts here">
        Add your first member to start building the club directory.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Joined</th>
            <th scope="col">Membership dues</th>
            <th scope="col">Expires</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <div className="person">
                  <span className="avatar">{initials(member.name)}</span>
                  <span>
                    <strong>{member.name}</strong>
                    <span className="subtext">{member.email}</span>
                  </span>
                </div>
              </td>
              <td>{date(member.joinedAt)}</td>
              <td>
                <span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>
                  {member.duesStatus === "paid" ? "Paid" : "Unpaid"}
                </span>
              </td>
              <td>{member.expiresOn ? date(member.expiresOn) : "Not set"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  color: string;
}) {
  return (
    <article className={`metric-card ${color === "dark" ? "metric-dark" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PanelHeading({
  kicker,
  title,
  action,
  onClick,
}: {
  kicker: string;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" type="button" onClick={onClick}>
          {action}
          <Icon name="arrow" size={16} />
        </button>
      )}
    </div>
  );
}

// ── Task Board ─────────────────────────────────────────────────────────────────

type TaskFilter = {
  status: "" | "todo" | "in_progress" | "done";
  assigneeId: string;
  eventId: string;
  overdue: boolean;
  mine: boolean;
};

function TaskBoard({ members, events, user, onChanged }: { members: Member[]; events: Event[]; user: SessionUser; onChanged: () => Promise<void> }) {
  const canWrite = user.permissions.includes("tasks:write");
  const [tasks, setTasks] = useState<TaskDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TaskFilter>({ status: "", assigneeId: "", eventId: "", overdue: false, mine: false });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showEditId, setShowEditId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set("status", filter.status);
      if (filter.assigneeId) params.set("assigneeId", filter.assigneeId);
      if (filter.eventId) params.set("eventId", filter.eventId);
      if (filter.overdue) params.set("overdue", "true");
      if (filter.mine) params.set("mine", "true");
      const res = await fetch(`/api/tasks?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load tasks.");
      setTasks(await res.json() as TaskDetails[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showCreate) titleRef.current?.focus(); }, [showCreate]);

  async function handleCreateTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setCreating(true);
    setCreateError("");
    try {
      const body: Record<string, string | undefined> = {
        title: String(fd.get("title") ?? "").trim(),
      };
      const desc = String(fd.get("description") ?? "").trim();
      const assigneeId = String(fd.get("assigneeId") ?? "").trim();
      const eventId = String(fd.get("eventId") ?? "").trim();
      const dueAt = String(fd.get("dueAt") ?? "").trim();
      if (desc) body.description = desc;
      if (assigneeId) body.assigneeId = assigneeId;
      if (eventId) body.eventId = eventId;
      if (dueAt) body.dueAt = new Date(dueAt).toISOString();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || "Failed to create task.");
      setShowCreate(false);
      form.reset();
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create task.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(id: string, status: "todo" | "in_progress" | "done") {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const r = await res.json() as { error?: string };
        throw new Error(r.error || "Failed to update status.");
      }
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const statusColumns: ("todo" | "in_progress" | "done")[] = ["todo", "in_progress", "done"];

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <span className="loader" />
        <span>Loading tasks…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>Couldn't load tasks.</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="task-toolbar">
        <div className="task-filters" role="group" aria-label="Task filters">
          <select
            className="filter-select"
            value={filter.status}
            aria-label="Filter by status"
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as TaskFilter["status"] }))}
          >
            <option value="">All statuses</option>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <select
            className="filter-select"
            value={filter.assigneeId}
            aria-label="Filter by assignee"
            onChange={(e) => setFilter((f) => ({ ...f, assigneeId: e.target.value }))}
          >
            <option value="">All assignees</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <select
            className="filter-select"
            value={filter.eventId}
            aria-label="Filter by event"
            onChange={(e) => setFilter((f) => ({ ...f, eventId: e.target.value }))}
          >
            <option value="">All events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filter.overdue}
              onChange={(e) => setFilter((f) => ({ ...f, overdue: e.target.checked }))}
            />
            Overdue only
          </label>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filter.mine}
              onChange={(e) => setFilter((f) => ({ ...f, mine: e.target.checked }))}
            />
            Assigned to me
          </label>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          disabled={!canWrite}
        >
          <Icon name="plus" size={16} />
          New task
        </button>
      </div>

      {/* Create task form */}
      {showCreate && (
        <section className="panel task-create-panel" aria-labelledby="task-create-heading">
          <div className="form-heading">
            <div>
              <h2 id="task-create-heading">Create a task</h2>
              <p>Assign work, set a deadline, and track progress.</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close task form"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              <Icon name="close" />
            </button>
          </div>
          <form onSubmit={handleCreateTask}>
            <div className="task-form-grid">
              <label>
                Task title *
                <input
                  ref={titleRef}
                  name="title"
                  placeholder="e.g. Set up registration table"
                  minLength={1}
                  maxLength={200}
                  required
                  disabled={creating}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  placeholder="Additional details…"
                  maxLength={2000}
                  disabled={creating}
                  rows={3}
                />
              </label>
              <label>
                Assign to
                <select name="assigneeId" disabled={creating}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Event
                <select name="eventId" disabled={creating}>
                  <option value="">No event</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              <label>
                Due date
                <input name="dueAt" type="datetime-local" disabled={creating} />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={creating}>
                {creating ? "Creating…" : "Create task"}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
            {createError && (
              <p className="form-error" role="alert">
                {createError}
              </p>
            )}
          </form>
        </section>
      )}

      {/* Kanban board */}
      {tasks.length === 0 && !showCreate ? (
        <section className="panel">
          <Empty title="No tasks match your filters">
            Clear the filters or create a new task to get started.
          </Empty>
        </section>
      ) : (
        <div className="kanban-grid">
          {statusColumns.map((status) => {
            const colTasks = filter.status ? tasks : tasks.filter((t) => t.status === status);
            if (filter.status && filter.status !== status) return null;
            return (
              <section key={status} className="kanban-column" aria-label={taskLabel[status]}>
                <h2>
                  <span className={`status-dot ${status}`} />
                  {taskLabel[status]}
                  <span className="column-count">{colTasks.length}</span>
                </h2>
                {colTasks.length === 0 && (
                  <p className="column-empty">No tasks here yet.</p>
                )}
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canWrite}
                    canChangeStatus={canWrite || task.assigneeId === user.id}
                    members={members}
                    updating={updatingId === task.id}
                    onStatusChange={handleStatusChange}
                    onEdit={() => setShowEditId(task.id === showEditId ? null : task.id)}
                    showEdit={showEditId === task.id}
                    onEditDone={() => { setShowEditId(null); void Promise.all([load(), onChanged()]); }}
                    events={events}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  canEdit,
  canChangeStatus,
  task,
  members,
  updating,
  onStatusChange,
  onEdit,
  showEdit,
  onEditDone,
  events,
}: {
  task: TaskDetails;
  canEdit: boolean;
  canChangeStatus: boolean;
  members: Member[];
  updating: boolean;
  onStatusChange: (id: string, status: "todo" | "in_progress" | "done") => void;
  onEdit: () => void;
  showEdit: boolean;
  onEditDone: () => void;
  events: Event[];
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string | null | undefined> = {};
      const title = String(fd.get("title") ?? "").trim();
      if (title) body.title = title;
      const desc = fd.get("description");
      body.description = desc ? String(desc).trim() : null;
      const assigneeId = fd.get("assigneeId");
      body.assigneeId = assigneeId ? String(assigneeId) : null;
      const eventId = fd.get("eventId");
      body.eventId = eventId ? String(eventId) : null;
      const dueAt = fd.get("dueAt");
      body.dueAt = dueAt ? new Date(String(dueAt)).toISOString() : null;
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || "Failed to update task.");
      onEditDone();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update task.");
    } finally {
      setSaving(false);
    }
  }

  const isOverdue = task.overdue;
  return (
    <article className={`task-card ${isOverdue ? "task-overdue" : ""}`}>
      <div className="task-card-header">
        <h3>{task.title}</h3>
        <div className="task-card-actions">
          {isOverdue && (
            <span className="badge red task-overdue-badge" title="Overdue">
              <Icon name="alert" size={10} />
              Overdue
            </span>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={showEdit ? "Close edit" : "Edit task"}
            disabled={!canEdit}
            onClick={onEdit}
          >
            <Icon name={showEdit ? "close" : "chevron"} size={14} />
          </button>
        </div>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        <div className="person">
          <span className="avatar small">
            {task.assignee ? initials(task.assignee) : "?"}
          </span>
          <span className="task-assignee">{task.assignee || "Unassigned"}</span>
        </div>
        {task.dueAt && (
          <span className={`task-due ${isOverdue ? "overdue-text" : ""}`}>
            <Icon name="clock" size={12} />
            {date(task.dueAt)}
          </span>
        )}
      </div>
      {task.eventTitle && (
        <div className="task-event-tag">
          <Icon name="calendar" size={11} />
          {task.eventTitle}
        </div>
      )}
      {/* Status updater */}
      <div className="task-status-row">
        <span className="task-status-label">Move to:</span>
        {(["todo", "in_progress", "done"] as const)
          .filter((s) => s !== task.status)
          .map((s) => (
            <button
              key={s}
              type="button"
              className={`status-chip ${s}`}
              disabled={updating || !canChangeStatus}
              onClick={() => onStatusChange(task.id, s)}
            >
              {taskLabel[s]}
            </button>
          ))}
      </div>
      {/* Inline edit form */}
      {showEdit && (
        <form className="task-edit-form" onSubmit={handleEdit}>
          <label>
            Title
            <input name="title" defaultValue={task.title} maxLength={200} disabled={saving} />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={task.description ?? ""}
              maxLength={2000}
              rows={2}
              disabled={saving}
            />
          </label>
          <label>
            Assignee
            <select name="assigneeId" defaultValue={task.assigneeId ?? ""} disabled={saving}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Event
            <select name="eventId" defaultValue={task.eventId ?? ""} disabled={saving}>
              <option value="">No event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </label>
          <label>
            Due date
            <input
              name="dueAt"
              type="datetime-local"
              defaultValue={task.dueAt ? localDateTimeValue(task.dueAt) : ""}
              disabled={saving}
            />
          </label>
          <button type="submit" className="button primary" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
        </form>
      )}
    </article>
  );
}

// ── My Expenses ────────────────────────────────────────────────────────────────

function MyExpenses({ user, events }: { user: SessionUser; events: Event[] }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const selfMember = user;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = selfMember ? `/api/expenses?submitterId=${selfMember.id}` : "/api/expenses";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load expenses.");
      setExpenses(await res.json() as Expense[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load expenses.");
    } finally {
      setLoading(false);
    }
  }, [selfMember]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selfMember) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amountStr = String(fd.get("amount") ?? "").trim();
    const purpose = String(fd.get("purpose") ?? "").trim();
    const receiptRef = String(fd.get("receiptReference") ?? "").trim();
    const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
    const eventId = String(fd.get("eventId") ?? "").trim();

    if (!amountStr || !purpose) {
      setSubmitError("Amount and purpose are required.");
      return;
    }

    const amountPaise = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amountPaise) || amountPaise < 1) {
      setSubmitError("Please enter a valid amount in rupees.");
      return;
    }
    if (!file || file.size === 0) {
      setSubmitError("Attach a JPG, PNG, or PDF receipt.");
      return;
    }
    if (file) {
      const allowedTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
      if (file.size > MAX_RECEIPT_SIZE_BYTES) {
        setSubmitError("Receipt files must be 5 MB or smaller.");
        return;
      }
      if (file.type && !allowedTypes.has(file.type)) {
        setSubmitError("Receipt must be a JPG, PNG, or PDF file.");
        return;
      }
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      let receiptId: string | undefined;

      // Handle file upload if provided
      if (file) {
        setUploadProgress("Uploading receipt…");
        const uploadFd = new FormData();
        uploadFd.append("file", file);
        const uploadRes = await fetch("/api/receipts", { method: "POST", body: uploadFd });
        const uploadResult = await uploadRes.json() as { id?: string; error?: string };
        if (!uploadRes.ok) throw new Error(uploadResult.error || "Receipt upload failed.");
        receiptId = uploadResult.id;
        setUploadProgress("");
      }

      const body: Record<string, string | number | undefined> = {
        amountPaise,
        purpose,
      };
      if (receiptId) body.receiptId = receiptId;
      if (receiptRef) body.receiptReference = receiptRef;
      if (eventId) body.eventId = eventId;

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || "Failed to submit expense.");
      setSubmitSuccess("Your expense has been submitted for review.");
      form.reset();
      setShowForm(false);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit expense.");
    } finally {
      setSubmitting(false);
      setUploadProgress("");
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <span className="loader" />
        <span>Loading your expense requests…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>Couldn't load expenses.</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="task-toolbar">
        <div />
        <button
          className="button primary"
          type="button"
          onClick={() => { setShowForm(true); setSubmitError(""); setSubmitSuccess(""); }}
        >
          <Icon name="plus" size={16} />
          Submit expense
        </button>
      </div>

      {submitSuccess && (
        <div className="success-message" role="status">
          <Icon name="check" size={18} />
          {submitSuccess}
        </div>
      )}

      {showForm && (
        <section className="panel task-create-panel" aria-labelledby="expense-form-heading">
          <div className="form-heading">
            <div>
              <h2 id="expense-form-heading">Submit an expense</h2>
              <p>
                Submitting as <strong>{selfMember?.name ?? "Demo member"}</strong>
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close expense form"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              <Icon name="close" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="task-form-grid">
              <label>
                Amount (₹) *
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 250.00"
                  required
                  disabled={submitting}
                />
              </label>
              <label>
                Purpose *
                <input
                  name="purpose"
                  placeholder="What was the expense for?"
                  minLength={3}
                  maxLength={500}
                  required
                  disabled={submitting}
                />
              </label>
              <label>
                Invoice / receipt reference
                <input
                  name="receiptReference"
                  placeholder="e.g. INV-2026-001"
                  maxLength={200}
                  disabled={submitting}
                />
              </label>
              <label>
                Event
                <select name="eventId" disabled={submitting}>
                  <option value="">No event</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              <label>
                Receipt file (JPG, PNG, or PDF · max 5 MB) *
                <input
                  name="receiptFile"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  required
                  disabled={submitting}
                  onChange={() => setUploading(false)}
                />
              </label>
            </div>
            {uploadProgress && (
              <p className="upload-progress" aria-live="polite">
                <span className="loader" />
                {uploadProgress}
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={submitting || uploading}>
                {submitting ? "Submitting…" : "Submit expense"}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
            {submitError && (
              <p className="form-error" role="alert">
                {submitError}
              </p>
            )}
          </form>
        </section>
      )}

      <section className="panel">
        <PanelHeading kicker="YOUR EXPENSE REQUESTS" title="Submitted expenses" />
        {expenses.length === 0 ? (
          <Empty title="No expense requests yet">
            Submit your first expense request using the button above.
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Purpose</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      <strong>{exp.purpose}</strong>
                      {exp.eventTitle && (
                        <span className="subtext">
                          <Icon name="calendar" size={10} /> {exp.eventTitle}
                        </span>
                      )}
                    </td>
                    <td className="amount-cell">{currency(exp.amountPaise)}</td>
                    <td>{date(exp.submittedAt)}</td>
                    <td>
                      <span className={`badge ${expenseStatusClass[exp.status] ?? "neutral"}`}>
                        {expenseStatusLabel[exp.status] ?? exp.status}
                      </span>
                    </td>
                    <td>
                      {exp.status === "rejected" && exp.rejectionNote && (
                        <span className="rejection-note">{exp.rejectionNote}</span>
                      )}
                      {exp.status === "paid" && exp.paymentReference && (
                        <span className="payment-ref">Ref: {exp.paymentReference}</span>
                      )}
                      {exp.status === "approved" && (
                        <span className="subtext">Approved · payment pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <PreviewNote>
        Expense amounts are in rupees. Approval and payment are managed by the treasurer in the Treasury section.
        Approved but unpaid expenses are counted as outstanding liabilities, not actual outflows.
      </PreviewNote>
    </div>
  );
}

// ── Treasury ───────────────────────────────────────────────────────────────────

function Treasury({ onChanged }: { onChanged: () => Promise<void> }) {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [actionError, setActionError] = useState("");
  const [paymentExpense, setPaymentExpense] = useState<Expense | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [source, setSource] = useState<LedgerSource | null>(null);
  const [sourceEntryId, setSourceEntryId] = useState<string | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "ledger">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, entriesRes, expensesRes] = await Promise.all([
        fetch("/api/ledger/summary", { cache: "no-store" }),
        fetch("/api/ledger/entries", { cache: "no-store" }),
        fetch("/api/expenses", { cache: "no-store" }),
      ]);
      if (!summaryRes.ok || !entriesRes.ok || !expensesRes.ok) throw new Error("Could not load treasury data.");
      const [s, e, ex] = await Promise.all([
        summaryRes.json() as Promise<LedgerSummary>,
        entriesRes.json() as Promise<LedgerEntry[]>,
        expensesRes.json() as Promise<Expense[]>,
      ]);
      setSummary(s);
      setEntries(e);
      setExpenses(ex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load treasury data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/ledger/export.csv");
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skyline-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExpenseAction(expenseId: string, action: "approve" | "reject" | "pay", extra: Record<string, string> = {}) {
    if (actionBusy) return;
    setActionError("");
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    if (action === "pay") {
      if (!extra.paymentReference?.trim()) { setActionError("Enter the payment reference before marking paid."); return; }
      extra = { paymentReference: extra.paymentReference.trim() };
    }
    if (action === "reject") {
      const note = window.prompt("Reason for rejecting this expense (optional):");
      if (note === null) return;
      extra = { note: note.trim() };
    }
    if (action === "approve" && !window.confirm(`Approve ${currency(expense.amountPaise)} for ${expense.purpose}?`)) return;
    if (action === "reject" && !window.confirm(`Reject the expense "${expense.purpose}"?`)) return;
    setActionBusy(true);
    try {
      const body: Record<string, string> = { ...extra };
      const res = await fetch(`/api/expenses/${expenseId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { error?: string };
      if (!res.ok) throw new Error(result.error || `Failed to ${action} expense.`);
      if (action === "pay") { setPaymentExpense(null); setPaymentReference(""); }
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to ${action} expense.`);
    } finally {
      setActionBusy(false);
    }
  }

  async function showSource(entryId: string) {
    setSourceEntryId(entryId);
    setSource(null);
    setSourceError("");
    setSourceBusy(true);
    try {
      const res = await fetch(`/api/ledger/entries/${encodeURIComponent(entryId)}/source`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not load the source record.");
      setSource(result as LedgerSource);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Could not load the source record.");
    } finally { setSourceBusy(false); }
  }

  const filteredEntries = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(s) ||
      (e.eventTitle?.toLowerCase().includes(s) ?? false) ||
      (e.category?.toLowerCase().includes(s) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <span className="loader" />
        <span>Loading treasury data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>Couldn't load treasury.</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  const pendingExpenses = expenses.filter((e) => e.status === "submitted");
  const approvedExpenses = expenses.filter((e) => e.status === "approved");

  return (
    <div>
      {/* Summary cards */}
      {summary && (
        <section className="metrics-grid treasury-metrics" aria-label="Financial summary">
          <Metric
            label="Total inflow"
            value={currency(summary.inflowPaise)}
            detail="Recorded income entries"
            icon="arrow"
            color="mint"
          />
          <Metric
            label="Paid outflow"
            value={currency(summary.outflowPaise)}
            detail="Expenses that have been paid"
            icon="wallet"
            color="peach"
          />
          <Metric
            label="Current balance"
            value={currency(summary.balancePaise)}
            detail="Inflow minus paid outflow"
            icon="coin"
            color="dark"
          />
          <Metric
            label="Approved · unpaid"
            value={currency(summary.approvedUnpaidPaise)}
            detail="Approved but not yet disbursed"
            icon="clock"
            color="lavender"
          />
        </section>
      )}

      {/* Tabs */}
      <div className="treasury-tabs" role="tablist">
        {(["overview", "expenses", "ledger"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            className={`treasury-tab ${activeTab === tab ? "active" : ""}`}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "overview" ? "Overview" : tab === "expenses" ? "Expense approvals" : "Ledger"}
            {tab === "expenses" && pendingExpenses.length > 0 && (
              <span className="nav-count">{pendingExpenses.length}</span>
            )}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="error-inline" role="alert">
          <Icon name="alert" size={14} />
          {actionError}
        </div>
      )}

      {/* Overview tab */}
      {activeTab === "overview" && summary && (
        <div className="treasury-overview-grid">
          {/* Category breakdown */}
          {summary.byCategory.length > 0 && (
            <section className="panel">
              <PanelHeading kicker="CATEGORY BREAKDOWN" title="By category" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col" className="amount-cell">Inflow</th>
                      <th scope="col" className="amount-cell">Outflow</th>
                      <th scope="col" className="amount-cell">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.map((cat) => (
                      <tr key={cat.category}>
                        <td><strong>{cat.category}</strong></td>
                        <td className="amount-cell positive">+{currency(cat.inflowPaise)}</td>
                        <td className="amount-cell">{cat.outflowPaise > 0 ? `−${currency(cat.outflowPaise)}` : "—"}</td>
                        <td className={`amount-cell ${cat.inflowPaise - cat.outflowPaise >= 0 ? "positive" : ""}`}>
                          {currency(cat.inflowPaise - cat.outflowPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {/* Event breakdown */}
          {summary.byEvent.length > 0 && (
            <section className="panel">
              <PanelHeading kicker="EVENT BREAKDOWN" title="By event" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col" className="amount-cell">Inflow</th>
                      <th scope="col" className="amount-cell">Outflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byEvent.map((ev) => (
                      <tr key={ev.eventId}>
                        <td><strong>{ev.eventTitle}</strong></td>
                        <td className="amount-cell positive">+{currency(ev.inflowPaise)}</td>
                        <td className="amount-cell">{ev.outflowPaise > 0 ? `−${currency(ev.outflowPaise)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {/* Outstanding liabilities note */}
          {summary.approvedUnpaidPaise > 0 && (
            <div className="outstanding-notice">
              <Icon name="alert" size={16} />
              <div>
                <strong>Outstanding liability</strong>
                <p>
                  {currency(summary.approvedUnpaidPaise)} in approved expenses are awaiting payment.
                  These are not counted in the current balance.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense approvals tab */}
      {activeTab === "expenses" && (
        <div>
          {pendingExpenses.length > 0 && (
            <section className="panel">
              <PanelHeading kicker="AWAITING REVIEW" title="Pending approvals" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Submitted by</th>
                      <th scope="col">Purpose</th>
                      <th scope="col" className="amount-cell">Amount</th>
                      <th scope="col">Date</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.submitterName}</strong></td>
                        <td>{exp.purpose}
                          {exp.receiptId && <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">View receipt</a></div>}
                          {exp.receiptReference && <div>Receipt reference: {exp.receiptReference}</div>}
                        </td>
                        <td className="amount-cell">{currency(exp.amountPaise)}</td>
                        <td>{date(exp.submittedAt)}</td>
                        <td>
                          <div className="expense-action-row">
                            <button
                              type="button"
                              className="button-small green-btn"
                              onClick={() => void handleExpenseAction(exp.id, "approve")}
                              disabled={actionBusy}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button-small red-btn"
                              onClick={() => void handleExpenseAction(exp.id, "reject")}
                              disabled={actionBusy}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {approvedExpenses.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }}>
              <PanelHeading kicker="APPROVED · AWAITING PAYMENT" title="Ready to pay" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Purpose</th>
                      <th scope="col" className="amount-cell">Amount</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.submitterName}</strong></td>
                        <td>{exp.purpose}
                          {exp.receiptId && <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">View receipt</a></div>}
                          {exp.receiptReference && <div>Receipt reference: {exp.receiptReference}</div>}
                        </td>
                        <td className="amount-cell">{currency(exp.amountPaise)}</td>
                        <td>
                          <button
                            type="button"
                            className="button-small"
                            onClick={() => { setPaymentExpense(exp); setPaymentReference(""); setActionError(""); }}
                            disabled={actionBusy}
                          >
                            Mark paid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {pendingExpenses.length === 0 && approvedExpenses.length === 0 && (
            <section className="panel">
              <Empty title="No expenses awaiting action">
                All expense requests are settled.
              </Empty>
            </section>
          )}
          <div className="all-expenses-section">
            <section className="panel" style={{ marginTop: 20 }}>
              <PanelHeading kicker="ALL EXPENSE REQUESTS" title="Complete history" />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Purpose</th>
                      <th scope="col" className="amount-cell">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.submitterName}</strong></td>
                        <td>
                          {exp.purpose}
                          {exp.rejectionNote && (
                            <span className="subtext rejection-note">{exp.rejectionNote}</span>
                          )}
                          {exp.paymentReference && (
                            <span className="subtext payment-ref">Ref: {exp.paymentReference}</span>
                          )}
                        </td>
                        <td className="amount-cell">{currency(exp.amountPaise)}</td>
                        <td>
                          <span className={`badge ${expenseStatusClass[exp.status] ?? "neutral"}`}>
                            {expenseStatusLabel[exp.status] ?? exp.status}
                          </span>
                        </td>
                        <td>{date(exp.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {paymentExpense && activeTab === "expenses" && (
        <section className="panel task-create-panel" aria-labelledby="payment-heading">
          <h2 id="payment-heading">Record completed payment</h2>
          <p>{paymentExpense.purpose} · {currency(paymentExpense.amountPaise)} · {paymentExpense.submitterName}</p>
          <p>This records an officer-confirmed reimbursement. It does not transfer money.</p>
          <form onSubmit={event => {
            event.preventDefault();
            void handleExpenseAction(paymentExpense.id, "pay", { paymentReference });
          }}>
            <label>Payment reference
              <input value={paymentReference} onChange={event => setPaymentReference(event.target.value)}
                required maxLength={200} disabled={actionBusy} autoFocus />
            </label>
            <div className="expense-action-row">
              <button className="button primary" type="submit" disabled={actionBusy}>
                {actionBusy ? "Recording…" : "Confirm paid"}
              </button>
              <button className="button" type="button" disabled={actionBusy} onClick={() => setPaymentExpense(null)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
      {/* Ledger tab */}
      {activeTab === "ledger" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">EVERY RUPEE, ACCOUNTED FOR</div>
              <h2>Transaction ledger</h2>
            </div>
            <div className="ledger-actions">
              <input
                className="ledger-search"
                type="search"
                placeholder="Search transactions…"
                value={search}
                aria-label="Search ledger entries"
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="button"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                <Icon name="download" size={15} />
                {exporting ? "Exporting…" : "Export CSV"}
              </button>
            </div>
          </div>
          {exportError && (
            <p className="form-error" role="alert" style={{ padding: "0 25px 12px" }}>
              {exportError}
            </p>
          )}
          {sourceEntryId && (
            <section className="task-create-panel" aria-label="Ledger source record">
              <button type="button" className="button-small" disabled={sourceBusy} onClick={() => { setSourceEntryId(null); setSource(null); }}>Close source</button>
              {sourceBusy && <p role="status">Loading source record…</p>}
              {sourceError && <p role="alert">{sourceError} <button className="button-small" onClick={() => void showSource(sourceEntryId)}>Retry source</button></p>}
              {source && <>
                <h3>{source.title}</h3>
                <p>{source.type} · {source.id}</p>
                <dl>{source.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
                {source.receiptId && <a href={`/api/receipts/${encodeURIComponent(source.receiptId)}`} download>Download receipt</a>}
              </>}
            </section>
          )}
          {filteredEntries.length === 0 ? (
            <Empty title="No transactions found">
              {search ? "Try a different search term." : "No ledger entries have been recorded yet."}
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Date</th>
                    <th scope="col">Category</th>
                    <th scope="col">Event</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Recorded by</th>
                    <th scope="col">Source</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="amount-cell">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td><strong>{entry.description}</strong></td>
                      <td>{date(entry.occurredAt)}</td>
                      <td>{entry.category ?? "—"}</td>
                      <td>{entry.eventTitle ?? "—"}</td>
                      <td>{entry.reference ?? "—"}</td>
                      <td>{entry.recordedByName ?? (entry.sourceType === "opening_balance" ? "System opening balance" : "Unknown officer")}</td>
                      <td>{entry.sourceId ? <a href={`/api/ledger/entries/${encodeURIComponent(entry.id)}/source`}
                        onClick={event => { event.preventDefault(); if (!sourceBusy) void showSource(entry.id); }}>
                        {entry.sourceType} · {entry.sourceId}
                      </a> : "Opening balance"}</td>
                      <td>
                        <span className={`badge ${entry.type === "income" ? "green" : "neutral"}`}>
                          {entry.type === "income" ? "Income" : "Expense (paid)"}
                        </span>
                      </td>
                      <td className={`amount-cell ${entry.type === "income" ? "positive" : ""}`}>
                        {entry.type === "income" ? "+" : "−"}
                        {currency(entry.amountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <PreviewNote>
        Only paid expenses appear in the ledger as actual outflows. Approved-but-unpaid expenses are shown
        separately above. Ledger entries and CSV export are restricted to treasurers in production.
      </PreviewNote>
    </div>
  );
}

function EventReportCard({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<EventReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/report`, { cache: "no-store" });
      if (!response.ok) throw new Error("Report unavailable.");
      setReport(await response.json() as EventReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report unavailable.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return <p className="event-report-error" role="alert">{error} <button type="button" className="text-button" onClick={() => void load()}>Retry</button></p>;
  }
  if (!report) return <div className="event-report-loading" role="status">Loading event report…</div>;

  return (
    <div className="event-report" aria-label={`${report.eventTitle} progress report`}>
      <div className="event-report-heading">
        <span className="eyebrow">EVENT REPORT</span>
        <span className={`badge ${report.fundraiser.onTrack ? "green" : "amber"}`}>
          {report.fundraiser.onTrack ? "On track" : "Needs attention"}
        </span>
      </div>
      <div className="report-progress-label">
        <span>Fundraiser · {currency(report.fundraiser.raisedPaise)} of {currency(report.fundraiser.goalPaise)}</span>
        <strong>{report.fundraiser.percent}%</strong>
      </div>
      <div className="capacity-bar report-bar"><span style={{ width: `${Math.min(100, Math.max(0, report.fundraiser.percent))}%` }} /></div>
      <div className="report-task-summary">
        <span>{report.tasks.total} tasks</span>
        <span>{report.tasks.done} done</span>
        <span>{report.tasks.inProgress} in progress</span>
        <span className={report.tasks.overdue > 0 ? "overdue-text" : ""}>{report.tasks.overdue} overdue</span>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [section, setSection] = useState<Section>("Overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [announcementQuery, setAnnouncementQuery] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<string[]>([]);
  const pendingTaskIds = useRef(new Set<string>());
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const nameInput = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const refreshDashboard = useCallback(async () => {
    setRefreshError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Dashboard refresh failed.");
      setData((await response.json()) as Dashboard);
    } catch {
      setRefreshError("Your change was saved, but the overview could not refresh.");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          "We couldn't load the workspace. Check that the server is running and try again.",
        );
      setData((await response.json()) as Dashboard);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't load the workspace. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showForm) nameInput.current?.focus(); }, [showForm]);
  useEffect(() => {
    const stored = window.localStorage.getItem("mode-theme");
    if (stored === "dark") setIsDark(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("mode-dark", isDark);
    window.localStorage.setItem("mode-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isUserMenuOpen]);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "members") setSection("Members");
      else if (hash === "events") setSection("Events");
      else if (hash === "tasks") setSection("Tasks");
      else if (hash === "treasury") setSection("Treasury");
      else if (hash === "announcements") setSection("Announcements");
      else if (hash === "merchandise") setSection("Merchandise");
      else if (hash === "expenses" || hash === "my-expenses") setSection("My Expenses");
      else if (hash === "overview") setSection("Overview");
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(values.get("name") ?? "").trim(),
          email: String(values.get("email") ?? "").trim(),
        }),
      });
      const result = (await response.json()) as { member?: Member; error?: string };
      if (!response.ok) throw new Error(result.error || "The member could not be added. Please try again.");
      setSuccess(`${result.member?.name ?? "Member"} was added. Their membership dues are unpaid.`);
      form.reset();
      setShowForm(false);
      await load();
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "The member could not be added. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveDashboardTask(task: Dashboard["tasks"][number], status: Dashboard["tasks"][number]["status"]) {
    if (task.status === status || pendingTaskIds.current.has(task.id)) return;
    if (!user.permissions.includes("tasks:write") && task.assigneeId !== user.id) return;
    pendingTaskIds.current.add(task.id);
    setSavingTaskIds([...pendingTaskIds.current]);
    setTaskErrors(current => ({ ...current, [task.id]: "" }));
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Task could not be saved. Please retry.");
      setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, status: result.status } : item) } : current);
    } catch (error) {
      setTaskErrors(current => ({ ...current, [task.id]: error instanceof Error ? error.message : "Task could not be saved. Please retry." }));
    } finally {
      pendingTaskIds.current.delete(task.id);
      setSavingTaskIds([...pendingTaskIds.current]);
    }
  }
  function dropDashboardTask(event: DragEvent<HTMLElement>, status: Dashboard["tasks"][number]["status"]) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = data?.tasks.find((item) => item.id === taskId);
    setDraggedTaskId(null);
    if (task) moveDashboardTask(task, status);
  }

  const income =
    data?.transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const expenses =
    data?.transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amountPaise, 0) ?? 0;
  const openTasks = data?.tasks.filter((task) => task.status !== "done") ?? [];
  const totalTasks = data?.tasks.length ?? 0;
  const completedTasks = data?.tasks.filter((task) => task.status === "done").length ?? 0;
  const taskProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const clubName = data?.club.name ?? "Skyline Student Association";
  const clubInitials = initials(clubName);
  const visibleAnnouncements = (data?.announcements ?? []).filter((item) => {
    const query = announcementQuery.trim().toLowerCase();
    return !query || `${item.title} ${item.body}`.toLowerCase().includes(query);
  });

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {isNavOpen && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setIsNavOpen(false)} />}
      <aside className={`sidebar ${isNavOpen ? "mobile-open" : ""}`} aria-label="Workspace navigation">
        <a className="brand" href="/" aria-label="MODE home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          MODE
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace-switch">
          <span className="club-monogram">{clubInitials}</span>
          <span>
            <strong>{clubName}</strong>
            <small>Student organization</small>
          </span>
        </div>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.filter(item => (item.label !== "Treasury" || user.permissions.includes("ledger:read")) && (item.label !== "Members" || user.permissions.includes("members:read"))).map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${section === item.label ? "active" : ""}`}
              aria-current={section === item.label ? "page" : undefined}
              onClick={() => { setSection(item.label); setSuccess(""); setIsNavOpen(false); }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Members" && data && (
                <span className="nav-count">{data.metrics.members}</span>
              )}
              {item.label === "Tasks" && data && openTasks.length > 0 && (
                <span className="nav-count">{openTasks.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-star">✳</span>
            <h3>
              Made for the
              <br />
              people who make it happen.
            </h3>
            <p>One home for your campus community.</p>
          </div>
          <a
            className="repo-link"
            href="https://github.com/users/nitishssh/projects/14"
            target="_blank"
            rel="noreferrer"
          >
            Team project board <Icon name="arrow" size={16} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            className="repo-link source-link"
            href="https://github.com/nitishssh/MODE"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub <Icon name="arrow" size={16} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <div className="sidebar-profile">
            <span className="profile-avatar">{clubInitials}</span>
            <span>
              <strong>Demo workspace</strong>
              <small>Signed in · {user.role}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setIsNavOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            Workspace <Icon name="chevron" size={13} />
            <span>{section}</span>
          </div>
          <div className="topbar-right">
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setIsDark((value) => !value)}
              aria-label={isDark ? "Use light theme" : "Use dark theme"}
              title={isDark ? "Use light theme" : "Use dark theme"}
            >
              <Icon name={isDark ? "sun" : "moon"} size={16} />
            </button>
            <span className="demo-indicator">
              <span />
              Fictional sample data
            </span>
            <div className="topbar-user-section" ref={userMenuRef}>
              <div
                className="topbar-progress-bar"
                title={`Task progress: ${taskProgressPercent}% (${completedTasks}/${totalTasks} completed)`}
              >
                <div
                  className="topbar-progress-fill"
                  style={{ width: `${taskProgressPercent}%` }}
                />
              </div>
              <button
                type="button"
                className={`topbar-avatar-btn ${isUserMenuOpen ? "active" : ""}`}
                onClick={() => setIsUserMenuOpen((open) => !open)}
                aria-label="User account menu"
                aria-expanded={isUserMenuOpen}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {isUserMenuOpen && (
                <div className="topbar-user-dropdown" role="menu">
                  <div className="dropdown-user-header">
                    <div className="dropdown-user-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="dropdown-user-info">
                      <strong>{user.name}</strong>
                      <span className="dropdown-role-badge">{user.role}</span>
                    </div>
                  </div>
                  <div className="dropdown-progress-stats">
                    <div className="dropdown-progress-label">
                      <span>Tasks completed</span>
                      <b>{completedTasks}/{totalTasks} ({taskProgressPercent}%)</b>
                    </div>
                    <div className="dropdown-progress-bar">
                      <div className="dropdown-progress-fill" style={{ width: `${taskProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-signout-btn"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {clubName.toUpperCase()} <span>/</span> WORKSPACE
              </div>
              <h1>
                {section === "Overview" ? (
                  <>
                    Your club, <span>in sync.</span>
                  </>
                ) : (
                  section
                )}
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            {user.permissions.includes("members:create") && (section === "Overview" || section === "Members") && (
              <button
                className="button primary"
                type="button"
                onClick={openMembers}
                disabled={loading || !!error}
              >
                <Icon name="plus" size={18} />
                Add member
              </button>
            )}
          </div>

          {success && (
            <div className="success-message" role="status">
              <Icon name="check" size={18} />
              {success}
            </div>
          )}
          {refreshError && (
            <div className="error-inline" role="alert">
              <span>{refreshError}</span>
              <button className="text-button" type="button" onClick={() => void refreshDashboard()}>Retry refresh</button>
            </div>
          )}
          {loading && <WorkspaceMainSkeleton />}
          {!loading && error && (
            <div className="error-state" role="alert">
              <h2>Let's try that again.</h2>
              <p>{error}</p>
              <button className="button primary" type="button" onClick={() => void load()}>
                Retry loading
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── Overview ─────────────────────────────────────────────── */}
              {section === "Overview" && (
                <>
                  <section className="metrics-grid" aria-label="Club at a glance">
                    <Metric
                      label="Total members"
                      value={String(data.metrics.members)}
                      detail={`${data.metrics.activeMembers} active memberships`}
                      icon="people"
                      color="lavender"
                    />
                    <Metric
                      label="Upcoming events"
                      value={String(data.metrics.upcomingEvents).padStart(2, "0")}
                      detail="Moments to bring everyone together"
                      icon="calendar"
                      color="peach"
                    />
                    <Metric
                      label="Open tasks"
                      value={String(openTasks.length).padStart(2, "0")}
                      detail={`${data.tasks.filter((task) => task.status === "done").length} tasks completed`}
                      icon="check"
                      color="mint"
                    />
                    <Metric
                      label="Club balance"
                      value={currency(data.metrics.balancePaise)}
                      detail="Recorded income minus expenses"
                      icon="wallet"
                      color="dark"
                    />
                  </section>

                  <div className="overview-grid">
                    <section className="panel events-panel">
                      <PanelHeading
                        kicker="MAKE SOME MEMORIES"
                        title="On the calendar"
                        action="All events"
                        onClick={() => setSection("Events")}
                      />
                      {data.events.length ? (
                        <div className="event-list">
                          {data.events.slice(0, 2).map((event, index) => (
                            <article className="event-row" key={event.id}>
                              <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}>
                                <span>{month(event.startsAt)}</span>
                                <strong>{day(event.startsAt)}</strong>
                              </div>
                              <div className="event-info">
                                <h3>{event.title}</h3>
                                <p>{event.venue}</p>
                                <div className="event-capacity">
                                  <span className="capacity-track">
                                    <span
                                      style={{
                                        width: `${event.capacity > 0 ? Math.min(100, (event.registered / event.capacity) * 100) : 0}%`,
                                      }}
                                    />
                                  </span>
                                  <span>
                                    {event.registered}/{event.capacity} registered
                                  </span>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Empty title="Room for the next big thing">
                          Events will appear here once they are recorded.
                        </Empty>
                      )}
                      <div className="panel-footnote">
                        <span className="tiny-dot" />
                        Event planning and ticketing are planned next.
                      </div>
                    </section>
                    <section className="panel tasks-panel">
                      <PanelHeading
                        kicker="LITTLE STEPS, BIG THINGS"
                        title="Team to-dos"
                        action="View all"
                        onClick={() => setSection("Tasks")}
                      />
                      {data.tasks.length ? (
                        <div className="dashboard-kanban" aria-label="Team task board">
                          {dashboardTaskStatuses.map((status) => {
                            const tasks = data.tasks.filter((task) => task.status === status);
                            return <section className={`dashboard-kanban-column ${status} ${draggedTaskId ? "is-drop-target" : ""}`} key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropDashboardTask(event, status)}>
                              <header><span className={`status-dot ${status}`} aria-hidden="true" /><span>{taskLabel[status]}</span><b>{tasks.length}</b></header>
                              <div className="dashboard-kanban-cards">
                                {tasks.length ? tasks.map((task) => <div key={task.id}><button type="button" disabled={savingTaskIds.includes(task.id) || (!user.permissions.includes("tasks:write") && task.assigneeId !== user.id)} draggable={!savingTaskIds.includes(task.id) && (user.permissions.includes("tasks:write") || task.assigneeId === user.id)} className={`dashboard-task-card ${task.status === "done" ? "completed" : ""} ${savingTaskIds.includes(task.id) ? "completing" : ""}`} onClick={() => moveDashboardTask(task, task.status === "done" ? "todo" : "done")} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id); setDraggedTaskId(task.id); }} onDragEnd={() => setDraggedTaskId(null)} title="Drag to a lane, or click to toggle completion"><span className="dashboard-task-title">{task.title}</span><span className="dashboard-task-assignee">{savingTaskIds.includes(task.id) ? "Saving…" : task.assignee || "Unassigned"}</span></button>{taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}</div>) : <p className="dashboard-kanban-empty">Drop tasks here</p>}
                              </div>
                            </section>;
                          })}
                        </div>
                      ) : (
                        <Empty title="Nothing on the to-do list">Your team is all caught up.</Empty>
                      )}
                    </section>
                  </div>

                  <div className="overview-bottom">
                    <section className="panel members-panel">
                      <PanelHeading
                        kicker="THE HEART OF YOUR CLUB"
                        title="Member directory"
                        action="All members"
                        onClick={() => setSection("Members")}
                      />
                      <MemberTable members={data.members.slice(0, 4)} />
                    </section>
                    <section className="notice-card">
                      <span className="notice-icon">
                        <Icon name="megaphone" size={23} />
                      </span>
                      <div className="eyebrow">FROM THE NOTICEBOARD</div>
                      {data.announcements[0] ? (
                        <>
                          <h2>{data.announcements[0].title}</h2>
                          <p>{data.announcements[0].body}</p>
                          <span className="notice-date">{date(data.announcements[0].publishedAt)}</span>
                        </>
                      ) : (
                        <>
                          <h2>A home for your updates.</h2>
                          <p>No announcements have been recorded yet.</p>
                        </>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSection("Announcements")}
                      >
                        Read announcements <Icon name="arrow" size={17} />
                      </button>
                    </section>
                  </div>
                </>
              )}

              {/* ── Members ──────────────────────────────────────────────── */}
              {section === "Members" && (
                <>
                  {showForm && (
                    <section
                      className="panel member-form-panel"
                      aria-labelledby="member-form-heading"
                    >
                      <div className="form-heading">
                        <div>
                          <h2 id="member-form-heading">Welcome someone new.</h2>
                          <p>
                            Add a member to the local club directory. Dues start as unpaid.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Close member form"
                          onClick={() => setShowForm(false)}
                          disabled={saving}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                      <form onSubmit={addMember}>
                        <div className="form-fields">
                          <label>
                            Full name
                            <input
                              ref={nameInput}
                              name="name"
                              placeholder="e.g. Alex Kumar"
                              autoComplete="name"
                              minLength={2}
                              maxLength={120}
                              required
                              disabled={saving}
                            />
                          </label>
                          <label>
                            Email address
                            <input
                              name="email"
                              type="email"
                              placeholder="alex@example.com"
                              autoComplete="email"
                              maxLength={254}
                              required
                              disabled={saving}
                            />
                          </label>
                          <button type="submit" className="button primary" disabled={saving}>
                            {saving ? "Adding member…" : "Add to directory"}
                            <Icon name="arrow" size={18} />
                          </button>
                        </div>
                        {formError && (
                          <p className="form-error" role="alert">
                            {formError}
                          </p>
                        )}
                      </form>
                    </section>
                  )}
                  <section className="panel">
                    <PanelHeading
                      title="Club directory"
                      kicker={`${data.metrics.members} MEMBERS · ${data.metrics.activeMembers} ACTIVE`}
                    />
                    <MemberTable members={data.members} />
                  </section>
                  <PreviewNote>
                    Member creation is connected to the local database. Dues collection, benefits, membership
                    editing, and renewal reminders are planned.
                  </PreviewNote>
                </>
              )}

              {/* ── Events ───────────────────────────────────────────────── */}
              {section === "Events" && (
                <>
                  <div className="event-cards">
                    {data.events.map((event) => (
                      <article key={event.id} className="panel event-card">
                        <div className="event-card-top">
                          <div className="date-tile coral">
                            <span>{month(event.startsAt)}</span>
                            <strong>{day(event.startsAt)}</strong>
                          </div>
                          <span className="badge neutral">Recorded event</span>
                        </div>
                        <h2>{event.title}</h2>
                        <p>
                          {event.venue} · {date(event.startsAt)}
                        </p>
                        <div className="capacity-bar">
                          <span
                            style={{
                              width: `${event.capacity > 0 ? Math.min(100, (event.registered / event.capacity) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className="event-numbers">
                          <span>{event.registered} registered</span>
                          <span>{event.capacity} capacity</span>
                        </div>
                        <div className="ticket-prices">
                          <div>
                            <span>Member ticket</span>
                            <strong>{currency(event.memberPricePaise)}</strong>
                          </div>
                          <div>
                            <span>Guest ticket</span>
                            <strong>{currency(event.guestPricePaise)}</strong>
                          </div>
                        </div>
                        {user.permissions.includes("events:report") && <EventReportCard eventId={event.id} />}
                      </article>
                    ))}
                  </div>
                  {!data.events.length && (
                    <section className="panel">
                      <Empty title="An open calendar">No events are recorded yet.</Empty>
                    </section>
                  )}
                  <PreviewNote>
                    Event creation, ticket sales, member discounts, capacity enforcement, and check-in are
                    planned. Prices and attendance shown here are sample records.
                  </PreviewNote>
                </>
              )}

              {/* ── Announcements ─────────────────────────────────────────── */}
              {section === "Announcements" && (
                <>
                  <div className="communication-toolbar">
                    <div>
                      <div className="eyebrow">PUBLISHED ARCHIVE</div>
                      <p className="communication-count">
                        {visibleAnnouncements.length} of {data.announcements.length} announcements
                      </p>
                    </div>
                    <label className="search-field">
                      <span className="sr-only">Search announcements</span>
                      <input
                        type="search"
                        value={announcementQuery}
                        placeholder="Search updates"
                        onChange={(event) => setAnnouncementQuery(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="announcement-list">
                    {visibleAnnouncements.map((item) => (
                      <article key={item.id} className="panel announcement-card">
                        <span className="announcement-symbol">
                          <Icon name="megaphone" size={22} />
                        </span>
                        <div>
                          <span className="eyebrow">{date(item.publishedAt)}</span>
                          <h2>{item.title}</h2>
                          <details className="announcement-details">
                            <summary>Read announcement</summary>
                            <p>{item.body}</p>
                          </details>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!visibleAnnouncements.length && (
                    <section className="panel">
                      <Empty title={data.announcements.length ? "No matching announcements" : "A quiet noticeboard"}>
                        {data.announcements.length
                          ? "Try a different search term."
                          : "No published announcements are available yet."}
                      </Empty>
                    </section>
                  )}
                  <PreviewNote>
                    Publishing, editing, mailing-list delivery, and announcement history management are
                    planned. No emails are sent by this starter.
                  </PreviewNote>
                </>
              )}

              {/* ── Merchandise ───────────────────────────────────────────── */}
              {section === "Merchandise" && (
                <>
                  <div className="catalogue-notice" role="status">
                    <Icon name="bag" size={16} />
                    <span>
                      Showing the server-backed product catalogue. Ordering is unavailable until the merchandise
                      variant and checkout APIs are connected.
                    </span>
                  </div>
                  <div className="product-grid">
                    {data.products.map((product, index) => (
                      <article key={product.id} className="panel product-card">
                        <div className={`product-art art-${index % 3}`}>
                          <Icon name="bag" size={64} />
                          <span>THE CLUB COLLECTION</span>
                        </div>
                        <div className="product-details">
                          <div>
                            <h2>{product.name}</h2>
                            <span className={product.stock > 0 ? "stock-available" : "stock-empty"}>
                              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                            </span>
                          </div>
                          <div className="product-price">
                            <strong>{currency(product.pricePaise)}</strong>
                            <button className="button-small" type="button" disabled aria-disabled="true">
                              Variants unavailable
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!data.products.length && (
                    <section className="panel">
                      <Empty title="Your next club essential">No merchandise is recorded yet.</Empty>
                    </section>
                  )}
                  <PreviewNote>
                    Product management, size variants, order collection, checkout, and stock updates are
                    planned. No purchase can be made here yet.
                  </PreviewNote>
                </>
              )}

              {/* ── Tasks ────────────────────────────────────────────────── */}
              {section === "Tasks" && <TaskBoard members={data.members} events={data.events} user={user} onChanged={refreshDashboard} />}

              {/* ── My Expenses ───────────────────────────────────────────── */}
              {section === "My Expenses" && <MyExpenses user={user} events={data.events} />}

              {/* ── Treasury ─────────────────────────────────────────────── */}
              {section === "Treasury" && user.permissions.includes("ledger:read") && <Treasury onChanged={refreshDashboard} />}
            </>
          )}

          <footer className="workspace-footer">
            <span>
              <span className="footer-dot" />
              MODE starter workspace
            </span>
            <p>Fictional seed records · Local database · Reimbursements record payments made outside MODE.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", {cache:"no-store"}).then(async response => {
      if (response.ok) { const result = await response.json(); if(active) setUser(result.user); }
      else if (response.status !== 401) throw new Error("Unable to check your session. Please sign in again.");
    }).catch(error => {if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});
    return () => {active=false;};
  }, []);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:String(values.get("email")),password:String(values.get("password"))})});
      const result = await response.json();
      if(!response.ok)throw new Error(result.error || "Sign in failed.");
      setUser(result.user);
    } catch(error) {setError(error instanceof Error ? error.message : "Sign in failed.");}
    finally {setBusy(false);}
  }
  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {method:"POST"});
      if(!response.ok)throw new Error("Sign out failed. Please try again.");
      setUser(null);
    } catch(error) {setError(error instanceof Error ? error.message : "Sign out failed.");}
  }
  if(loading)return <main className="loading-state" role="status">Loading your workspace…</main>;
  if(user)return <>{error && <p role="alert">{error}</p>}<Workspace key={user.id} user={user} onLogout={()=>void signOut()} /></>;
  return <main className="auth-screen"><section className="auth-card">
    <h1>Sign in to MODE</h1><p>Use your club account to manage tasks and expenses.</p>
    <form onSubmit={signIn}>
      <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </section></main>;
}
