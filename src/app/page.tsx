"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import { WorkspaceMainSkeleton } from "./skeleton";
import { LandingPage } from "@/components/landing-page";
import ShinyButton from "@/components/ui/shiny-button";
import MerchandiseShop from "@/components/merchandise-shop";
import { localDateTimeValue } from "@/lib/local-datetime";
import { LanguageSwitcher, useI18n } from "@/i18n/client";
import type { DictionaryKey } from "@/i18n/dictionaries/en";
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
import { PricingInteraction } from "@/components/ui/pricing-interaction";
import { ReorderList } from "@/components/ui/reorder-list";

/** Keep asynchronous request messages current without making locale a fetch dependency. */
function useRequestMessages() {
  const { t } = useI18n();
  const messages = useRef(t);
  useEffect(() => { messages.current = t; }, [t]);
  return messages;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Section =
  | "overview"
  | "members"
  | "events"
  | "announcements"
  | "merchandise"
  | "tasks"
  | "expenses"
  | "treasury"
  | "subscription";

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
  | "search"
  | "sun"
  | "moon";

const navigation: { id: Exclude<Section, "subscription">; icon: IconName }[] = [
  { id: "overview", icon: "grid" },
  { id: "members", icon: "people" },
  { id: "events", icon: "calendar" },
  { id: "announcements", icon: "megaphone" },
  { id: "merchandise", icon: "bag" },
  { id: "tasks", icon: "check" },
  { id: "expenses", icon: "receipt" },
  { id: "treasury", icon: "wallet" },
];

const sectionFromHash: Record<string, Section> = {
  overview: "overview",
  members: "members",
  events: "events",
  announcements: "announcements",
  merchandise: "merchandise",
  tasks: "tasks",
  expenses: "expenses",
  "my-expenses": "expenses",
  treasury: "treasury",
};

type TaskStatus = "todo" | "in_progress" | "done";

// ── Formatters ─────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

const expenseStatusClass: Record<string, string> = {
  submitted: "amber",
  approved: "purple",
  rejected: "red",
  paid: "green",
};

const expenseStatusKey = (status: string): DictionaryKey | null =>
  status === "submitted" || status === "approved" || status === "rejected" || status === "paid"
    ? `expenses.status.${status}`
    : null;

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
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 5 5" />
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
      className="icon"
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
  const { t } = useI18n();
  return (
    <div className="preview-note">
      <span className="badge neutral">{t("common.starterPreview")}</span>
      <p>{children}</p>
    </div>
  );
}

function MemberTable({ members }: { members: Member[] }) {
  const { t, fmt } = useI18n();
  if (!members.length)
    return <Empty title={t("members.emptyTitle")}>{t("members.emptyBody")}</Empty>;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">{t("members.colMember")}</th>
            <th scope="col">{t("members.colJoined")}</th>
            <th scope="col">{t("members.colDues")}</th>
            <th scope="col">{t("members.colExpires")}</th>
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
              <td>{fmt.date(member.joinedAt)}</td>
              <td>
                <span className={`badge ${member.duesStatus === "paid" ? "green" : "amber"}`}>
                  {member.duesStatus === "paid" ? t("members.paid") : t("members.unpaid")}
                </span>
              </td>
              <td>{member.expiresOn ? fmt.date(member.expiresOn) : t("common.notSet")}</td>
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
  status: "" | TaskStatus;
  assigneeId: string;
  eventId: string;
  overdue: boolean;
  mine: boolean;
};

function TaskBoard({ members, events, user, onChanged }: { members: Member[]; events: Event[]; user: SessionUser; onChanged: () => Promise<void> }) {
  const { t, apiError } = useI18n();
  const messages = useRequestMessages();
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
      if (!res.ok) throw new Error(messages.current("tasks.loadFailed"));
      setTasks(await res.json() as TaskDetails[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.current("tasks.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filter, messages]);

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
      const result = await res.json() as { error?: string; code?: string };
      if (!res.ok) throw new Error(apiError(result, "tasks.createFailed"));
      setShowCreate(false);
      form.reset();
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : t("tasks.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const r = await res.json() as { error?: string; code?: string };
        throw new Error(apiError(r, "tasks.statusFailed"));
      }
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tasks.statusFailed"));
    } finally {
      setUpdatingId(null);
    }
  }

  const statusColumns: TaskStatus[] = ["todo", "in_progress", "done"];

  if (loading) {
    return (
      <div className="loading-state" role="status" aria-live="polite">
        <span className="loader" />
        <span>{t("tasks.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>{t("tasks.errorTitle")}</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="task-toolbar">
        <div className="task-filters" role="group" aria-label={t("tasks.filters")}>
          <select
            className="filter-select"
            value={filter.status}
            aria-label={t("tasks.filterStatus")}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as TaskFilter["status"] }))}
          >
            <option value="">{t("tasks.allStatuses")}</option>
            <option value="todo">{t("tasks.status.todo")}</option>
            <option value="in_progress">{t("tasks.status.in_progress")}</option>
            <option value="done">{t("tasks.status.done")}</option>
          </select>
          <select
            className="filter-select"
            value={filter.assigneeId}
            aria-label={t("tasks.filterAssignee")}
            onChange={(e) => setFilter((f) => ({ ...f, assigneeId: e.target.value }))}
          >
            <option value="">{t("tasks.allAssignees")}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <select
            className="filter-select"
            value={filter.eventId}
            aria-label={t("tasks.filterEvent")}
            onChange={(e) => setFilter((f) => ({ ...f, eventId: e.target.value }))}
          >
            <option value="">{t("tasks.allEvents")}</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filter.overdue}
              onChange={(e) => setFilter((f) => ({ ...f, overdue: e.target.checked }))}
            />
            {t("tasks.overdueOnly")}
          </label>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filter.mine}
              onChange={(e) => setFilter((f) => ({ ...f, mine: e.target.checked }))}
            />
            {t("tasks.assignedToMe")}
          </label>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          disabled={!canWrite}
        >
          <Icon name="plus" size={16} />
          {t("tasks.newTask")}
        </button>
      </div>

      {/* Create task form */}
      {showCreate && (
        <section className="panel task-create-panel" aria-labelledby="task-create-heading">
          <div className="form-heading">
            <div>
              <h2 id="task-create-heading">{t("tasks.createTitle")}</h2>
              <p>{t("tasks.createBody")}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("tasks.closeForm")}
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >
              <Icon name="close" />
            </button>
          </div>
          <form onSubmit={handleCreateTask}>
            <div className="task-form-grid">
              <label>
                {t("tasks.titleLabel")}
                <input
                  ref={titleRef}
                  name="title"
                  placeholder={t("tasks.titlePlaceholder")}
                  minLength={1}
                  maxLength={200}
                  required
                  disabled={creating}
                />
              </label>
              <label>
                {t("common.description")}
                <textarea
                  name="description"
                  placeholder={t("tasks.descriptionPlaceholder")}
                  maxLength={2000}
                  disabled={creating}
                  rows={3}
                />
              </label>
              <label>
                {t("tasks.assignTo")}
                <select name="assigneeId" disabled={creating}>
                  <option value="">{t("common.unassigned")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("common.event")}
                <select name="eventId" disabled={creating}>
                  <option value="">{t("common.noEvent")}</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              <label>
                {t("common.dueDate")}
                <input name="dueAt" type="datetime-local" disabled={creating} />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary" disabled={creating}>
                {creating ? t("tasks.creating") : t("tasks.create")}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                {t("common.cancel")}
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
          <Empty title={t("tasks.emptyTitle")}>{t("tasks.emptyBody")}</Empty>
        </section>
      ) : (
        <div className="kanban-grid">
          {statusColumns.map((status) => {
            const colTasks = filter.status ? tasks : tasks.filter((task) => task.status === status);
            if (filter.status && filter.status !== status) return null;
            return (
              <section key={status} className="kanban-column" aria-label={t(`tasks.status.${status}`)}>
                <h2>
                  <span className={`status-dot ${status}`} />
                  {t(`tasks.status.${status}`)}
                  <span className="column-count">{colTasks.length}</span>
                </h2>
                {colTasks.length === 0 && (
                  <p className="column-empty">{t("tasks.columnEmpty")}</p>
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
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: () => void;
  showEdit: boolean;
  onEditDone: () => void;
  events: Event[];
}) {
  const { t, fmt, apiError } = useI18n();
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
      const result = await res.json() as { error?: string; code?: string };
      if (!res.ok) throw new Error(apiError(result, "tasks.updateFailed"));
      onEditDone();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("tasks.updateFailed"));
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
            <span className="badge red task-overdue-badge" title={t("tasks.overdue")}>
              <Icon name="alert" size={10} />
              {t("tasks.overdue")}
            </span>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={showEdit ? t("tasks.closeEdit") : t("tasks.edit")}
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
          <span className="task-assignee">{task.assignee || t("common.unassigned")}</span>
        </div>
        {task.dueAt && (
          <span className={`task-due ${isOverdue ? "overdue-text" : ""}`}>
            <Icon name="clock" size={12} />
            {fmt.date(task.dueAt)}
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
        <span className="task-status-label">{t("tasks.moveTo")}</span>
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
              {t(`tasks.status.${s}`)}
            </button>
          ))}
      </div>
      {/* Inline edit form */}
      {showEdit && (
        <form className="task-edit-form" onSubmit={handleEdit}>
          <label>
            {t("common.title")}
            <input name="title" defaultValue={task.title} maxLength={200} disabled={saving} />
          </label>
          <label>
            {t("common.description")}
            <textarea
              name="description"
              defaultValue={task.description ?? ""}
              maxLength={2000}
              rows={2}
              disabled={saving}
            />
          </label>
          <label>
            {t("tasks.assignee")}
            <select name="assigneeId" defaultValue={task.assigneeId ?? ""} disabled={saving}>
              <option value="">{t("common.unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.event")}
            <select name="eventId" defaultValue={task.eventId ?? ""} disabled={saving}>
              <option value="">{t("common.noEvent")}</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </label>
          <label>
            {t("common.dueDate")}
            <input
              name="dueAt"
              type="datetime-local"
              defaultValue={task.dueAt ? localDateTimeValue(task.dueAt) : ""}
              disabled={saving}
            />
          </label>
          <button type="submit" className="button primary" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? t("tasks.saving") : t("tasks.save")}
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
  const { t, fmt, apiError } = useI18n();
  const messages = useRequestMessages();
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
      if (!res.ok) throw new Error(messages.current("expenses.loadFailed"));
      setExpenses(await res.json() as Expense[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.current("expenses.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [selfMember, messages]);

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
      setSubmitError(t("expenses.required"));
      return;
    }

    const amountPaise = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amountPaise) || amountPaise < 1) {
      setSubmitError(t("expenses.invalidAmount"));
      return;
    }
    if (!file || file.size === 0) {
      setSubmitError(t("expenses.fileRequired"));
      return;
    }
    if (file) {
      const allowedTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
      if (file.size > MAX_RECEIPT_SIZE_BYTES) {
        setSubmitError(t("expenses.fileTooLarge"));
        return;
      }
      if (file.type && !allowedTypes.has(file.type)) {
        setSubmitError(t("expenses.fileType"));
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
        setUploadProgress(t("expenses.uploading"));
        const uploadFd = new FormData();
        uploadFd.append("file", file);
        const uploadRes = await fetch("/api/receipts", { method: "POST", body: uploadFd });
        const uploadResult = await uploadRes.json() as { id?: string; error?: string; code?: string };
        if (!uploadRes.ok) throw new Error(apiError(uploadResult, "expenses.uploadFailed"));
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
      const result = await res.json() as { error?: string; code?: string };
      if (!res.ok) throw new Error(apiError(result, "expenses.submitFailed"));
      setSubmitSuccess(t("expenses.submitted"));
      form.reset();
      setShowForm(false);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t("expenses.submitFailed"));
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
        <span>{t("expenses.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>{t("expenses.errorTitle")}</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          {t("common.tryAgain")}
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
          {t("expenses.submit")}
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
              <h2 id="expense-form-heading">{t("expenses.formTitle")}</h2>
              <p>
                {t("expenses.submittingAs")} <strong>{selfMember?.name ?? t("expenses.demoMember")}</strong>
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("expenses.closeForm")}
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              <Icon name="close" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="task-form-grid">
              <label>
                {t("expenses.amountLabel")}
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder={t("expenses.amountPlaceholder")}
                  required
                  disabled={submitting}
                />
              </label>
              <label>
                {t("expenses.purposeLabel")}
                <input
                  name="purpose"
                  placeholder={t("expenses.purposePlaceholder")}
                  minLength={3}
                  maxLength={500}
                  required
                  disabled={submitting}
                />
              </label>
              <label>
                {t("expenses.referenceLabel")}
                <input
                  name="receiptReference"
                  placeholder={t("expenses.referencePlaceholder")}
                  maxLength={200}
                  disabled={submitting}
                />
              </label>
              <label>
                {t("common.event")}
                <select name="eventId" disabled={submitting}>
                  <option value="">{t("common.noEvent")}</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
              </label>
              <label>
                {t("expenses.fileLabel")}
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
                {submitting ? t("expenses.submitting") : t("expenses.submit")}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                {t("common.cancel")}
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
        <PanelHeading kicker={t("expenses.listKicker")} title={t("expenses.listTitle")} />
        {expenses.length === 0 ? (
          <Empty title={t("expenses.emptyTitle")}>{t("expenses.emptyBody")}</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("common.purpose")}</th>
                  <th scope="col">{t("common.amount")}</th>
                  <th scope="col">{t("common.date")}</th>
                  <th scope="col">{t("common.status")}</th>
                  <th scope="col">{t("common.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const statusKey = expenseStatusKey(exp.status);
                  return (
                    <tr key={exp.id}>
                      <td>
                        <strong>{exp.purpose}</strong>
                        {exp.eventTitle && (
                          <span className="subtext">
                            <Icon name="calendar" size={10} /> {exp.eventTitle}
                          </span>
                        )}
                      </td>
                      <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                      <td>{fmt.date(exp.submittedAt)}</td>
                      <td>
                        <span className={`badge ${expenseStatusClass[exp.status] ?? "neutral"}`}>
                          {statusKey ? t(statusKey) : exp.status}
                        </span>
                      </td>
                      <td>
                        {exp.status === "rejected" && exp.rejectionNote && (
                          <span className="rejection-note">{exp.rejectionNote}</span>
                        )}
                        {exp.status === "paid" && exp.paymentReference && (
                          <span className="payment-ref">{t("common.ref", { reference: exp.paymentReference })}</span>
                        )}
                        {exp.status === "approved" && (
                          <span className="subtext">{t("expenses.approvedPending")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <PreviewNote>{t("expenses.preview")}</PreviewNote>
    </div>
  );
}

// ── Treasury ───────────────────────────────────────────────────────────────────

function Treasury({ onChanged }: { onChanged: () => Promise<void> }) {
  const { t, fmt, apiError } = useI18n();
  const messages = useRequestMessages();
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
      if (!summaryRes.ok || !entriesRes.ok || !expensesRes.ok) throw new Error(messages.current("treasury.loadFailed"));
      const [s, e, ex] = await Promise.all([
        summaryRes.json() as Promise<LedgerSummary>,
        entriesRes.json() as Promise<LedgerEntry[]>,
        expensesRes.json() as Promise<Expense[]>,
      ]);
      setSummary(s);
      setEntries(e);
      setExpenses(ex);
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.current("treasury.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [messages]);

  useEffect(() => { void load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const res = await fetch("/api/ledger/export.csv");
      if (!res.ok) throw new Error(t("treasury.exportFailed"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skyline-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t("treasury.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  const actionFailedKey: Record<"approve" | "reject" | "pay", DictionaryKey> = {
    approve: "treasury.approveFailed",
    reject: "treasury.rejectFailed",
    pay: "treasury.payFailed",
  };

  async function handleExpenseAction(expenseId: string, action: "approve" | "reject" | "pay", extra: Record<string, string> = {}) {
    if (actionBusy) return;
    setActionError("");
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    const amount = fmt.currency(expense.amountPaise);
    if (action === "pay") {
      if (!extra.paymentReference?.trim()) { setActionError(t("treasury.paymentRequired")); return; }
      extra = { paymentReference: extra.paymentReference.trim() };
    }
    if (action === "reject") {
      const note = window.prompt(t("treasury.promptReject"));
      if (note === null) return;
      extra = { note: note.trim() };
    }
    if (action === "approve" && !window.confirm(t("treasury.confirmApprove", { amount, purpose: expense.purpose }))) return;
    if (action === "reject" && !window.confirm(t("treasury.confirmReject", { purpose: expense.purpose }))) return;
    setActionBusy(true);
    try {
      const body: Record<string, string> = { ...extra };
      const res = await fetch(`/api/expenses/${expenseId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { error?: string; code?: string };
      if (!res.ok) throw new Error(apiError(result, actionFailedKey[action]));
      if (action === "pay") { setPaymentExpense(null); setPaymentReference(""); }
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t(actionFailedKey[action]));
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
      const result = await res.json() as { error?: string; code?: string };
      if (!res.ok) throw new Error(apiError(result, "treasury.sourceFailed"));
      setSource(result as unknown as LedgerSource);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : t("treasury.sourceFailed"));
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
        <span>{t("treasury.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state" role="alert">
        <h2>{t("treasury.errorTitle")}</h2>
        <p>{error}</p>
        <button className="button primary" type="button" onClick={() => void load()}>
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }

  const pendingExpenses = expenses.filter((e) => e.status === "submitted");
  const approvedExpenses = expenses.filter((e) => e.status === "approved");
  const tabLabel = { overview: t("treasury.tabOverview"), expenses: t("treasury.tabExpenses"), ledger: t("treasury.tabLedger") };

  return (
    <div>
      {/* Summary cards */}
      {summary && (
        <section className="metrics-grid treasury-metrics" aria-label={t("treasury.summaryLabel")}>
          <Metric
            label={t("treasury.totalInflow")}
            value={fmt.currency(summary.inflowPaise)}
            detail={t("treasury.inflowDetail")}
            icon="arrow"
            color="mint"
          />
          <Metric
            label={t("treasury.paidOutflow")}
            value={fmt.currency(summary.outflowPaise)}
            detail={t("treasury.outflowDetail")}
            icon="wallet"
            color="peach"
          />
          <Metric
            label={t("treasury.currentBalance")}
            value={fmt.currency(summary.balancePaise)}
            detail={t("treasury.balanceDetail")}
            icon="coin"
            color="dark"
          />
          <Metric
            label={t("treasury.approvedUnpaid")}
            value={fmt.currency(summary.approvedUnpaidPaise)}
            detail={t("treasury.approvedUnpaidDetail")}
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
            {tabLabel[tab]}
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
              <PanelHeading kicker={t("treasury.categoryKicker")} title={t("treasury.categoryTitle")} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("common.category")}</th>
                      <th scope="col" className="amount-cell">{t("common.inflow")}</th>
                      <th scope="col" className="amount-cell">{t("common.outflow")}</th>
                      <th scope="col" className="amount-cell">{t("common.net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.map((cat) => (
                      <tr key={cat.category}>
                        <td><strong>{cat.category}</strong></td>
                        <td className="amount-cell positive">+{fmt.currency(cat.inflowPaise)}</td>
                        <td className="amount-cell">{cat.outflowPaise > 0 ? `−${fmt.currency(cat.outflowPaise)}` : "—"}</td>
                        <td className={`amount-cell ${cat.inflowPaise - cat.outflowPaise >= 0 ? "positive" : ""}`}>
                          {fmt.currency(cat.inflowPaise - cat.outflowPaise)}
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
              <PanelHeading kicker={t("treasury.eventKicker")} title={t("treasury.eventTitle")} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("common.event")}</th>
                      <th scope="col" className="amount-cell">{t("common.inflow")}</th>
                      <th scope="col" className="amount-cell">{t("common.outflow")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byEvent.map((ev) => (
                      <tr key={ev.eventId}>
                        <td><strong>{ev.eventTitle}</strong></td>
                        <td className="amount-cell positive">+{fmt.currency(ev.inflowPaise)}</td>
                        <td className="amount-cell">{ev.outflowPaise > 0 ? `−${fmt.currency(ev.outflowPaise)}` : "—"}</td>
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
                <strong>{t("treasury.liabilityTitle")}</strong>
                <p>{t("treasury.liabilityBody", { amount: fmt.currency(summary.approvedUnpaidPaise) })}</p>
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
              <PanelHeading kicker={t("treasury.pendingKicker")} title={t("treasury.pendingTitle")} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("treasury.submittedBy")}</th>
                      <th scope="col">{t("common.purpose")}</th>
                      <th scope="col" className="amount-cell">{t("common.amount")}</th>
                      <th scope="col">{t("common.date")}</th>
                      <th scope="col">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.submitterName}</strong></td>
                        <td>{exp.purpose}
                          {exp.receiptId && <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">{t("common.viewReceipt")}</a></div>}
                          {exp.receiptReference && <div>{t("common.receiptReference", { reference: exp.receiptReference })}</div>}
                        </td>
                        <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                        <td>{fmt.date(exp.submittedAt)}</td>
                        <td>
                          <div className="expense-action-row">
                            <button
                              type="button"
                              className="button-small green-btn"
                              onClick={() => void handleExpenseAction(exp.id, "approve")}
                              disabled={actionBusy}
                            >
                              {t("treasury.approve")}
                            </button>
                            <button
                              type="button"
                              className="button-small red-btn"
                              onClick={() => void handleExpenseAction(exp.id, "reject")}
                              disabled={actionBusy}
                            >
                              {t("treasury.reject")}
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
              <PanelHeading kicker={t("treasury.readyKicker")} title={t("treasury.readyTitle")} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("common.member")}</th>
                      <th scope="col">{t("common.purpose")}</th>
                      <th scope="col" className="amount-cell">{t("common.amount")}</th>
                      <th scope="col">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.submitterName}</strong></td>
                        <td>{exp.purpose}
                          {exp.receiptId && <div><a href={`/api/receipts/${encodeURIComponent(exp.receiptId)}`} target="_blank" rel="noreferrer">{t("common.viewReceipt")}</a></div>}
                          {exp.receiptReference && <div>{t("common.receiptReference", { reference: exp.receiptReference })}</div>}
                        </td>
                        <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                        <td>
                          <button
                            type="button"
                            className="button-small"
                            onClick={() => { setPaymentExpense(exp); setPaymentReference(""); setActionError(""); }}
                            disabled={actionBusy}
                          >
                            {t("treasury.markPaid")}
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
              <Empty title={t("treasury.settledTitle")}>{t("treasury.settledBody")}</Empty>
            </section>
          )}
          <div className="all-expenses-section">
            <section className="panel" style={{ marginTop: 20 }}>
              <PanelHeading kicker={t("treasury.historyKicker")} title={t("treasury.historyTitle")} />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("common.member")}</th>
                      <th scope="col">{t("common.purpose")}</th>
                      <th scope="col" className="amount-cell">{t("common.amount")}</th>
                      <th scope="col">{t("common.status")}</th>
                      <th scope="col">{t("treasury.submittedCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => {
                      const statusKey = expenseStatusKey(exp.status);
                      return (
                        <tr key={exp.id}>
                          <td><strong>{exp.submitterName}</strong></td>
                          <td>
                            {exp.purpose}
                            {exp.rejectionNote && (
                              <span className="subtext rejection-note">{exp.rejectionNote}</span>
                            )}
                            {exp.paymentReference && (
                              <span className="subtext payment-ref">{t("common.ref", { reference: exp.paymentReference })}</span>
                            )}
                          </td>
                          <td className="amount-cell">{fmt.currency(exp.amountPaise)}</td>
                          <td>
                            <span className={`badge ${expenseStatusClass[exp.status] ?? "neutral"}`}>
                              {statusKey ? t(statusKey) : exp.status}
                            </span>
                          </td>
                          <td>{fmt.date(exp.submittedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {paymentExpense && activeTab === "expenses" && (
        <section className="panel task-create-panel" aria-labelledby="payment-heading">
          <h2 id="payment-heading">{t("treasury.paymentTitle")}</h2>
          <p>{paymentExpense.purpose} · {fmt.currency(paymentExpense.amountPaise)} · {paymentExpense.submitterName}</p>
          <p>{t("treasury.paymentNote")}</p>
          <form onSubmit={event => {
            event.preventDefault();
            void handleExpenseAction(paymentExpense.id, "pay", { paymentReference });
          }}>
            <label>{t("treasury.paymentReference")}
              <input value={paymentReference} onChange={event => setPaymentReference(event.target.value)}
                required maxLength={200} disabled={actionBusy} autoFocus />
            </label>
            <div className="expense-action-row">
              <button className="button primary" type="submit" disabled={actionBusy}>
                {actionBusy ? t("treasury.recording") : t("treasury.confirmPaid")}
              </button>
              <button className="button" type="button" disabled={actionBusy} onClick={() => setPaymentExpense(null)}>{t("common.cancel")}</button>
            </div>
          </form>
        </section>
      )}
      {/* Ledger tab */}
      {activeTab === "ledger" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t("treasury.ledgerKicker")}</div>
              <h2>{t("treasury.ledgerTitle")}</h2>
            </div>
            <div className="ledger-actions">
              <input
                className="ledger-search"
                type="search"
                placeholder={t("treasury.searchPlaceholder")}
                value={search}
                aria-label={t("treasury.searchLabel")}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="button"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                <Icon name="download" size={15} />
                {exporting ? t("treasury.exporting") : t("treasury.exportCsv")}
              </button>
            </div>
          </div>
          {exportError && (
            <p className="form-error" role="alert" style={{ padding: "0 25px 12px" }}>
              {exportError}
            </p>
          )}
          {sourceEntryId && (
            <section className="task-create-panel" aria-label={t("treasury.sourceLabel")}>
              <button type="button" className="button-small" disabled={sourceBusy} onClick={() => { setSourceEntryId(null); setSource(null); }}>{t("treasury.closeSource")}</button>
              {sourceBusy && <p role="status">{t("treasury.sourceLoading")}</p>}
              {sourceError && <p role="alert">{sourceError} <button className="button-small" onClick={() => void showSource(sourceEntryId)}>{t("treasury.retrySource")}</button></p>}
              {source && <>
                <h3>{source.title}</h3>
                <p>{source.type} · {source.id}</p>
                <dl>{source.details.map(detail => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
                {source.receiptId && <a href={`/api/receipts/${encodeURIComponent(source.receiptId)}`} download>{t("treasury.downloadReceipt")}</a>}
              </>}
            </section>
          )}
          {filteredEntries.length === 0 ? (
            <Empty title={t("treasury.noTransactions")}>
              {search ? t("treasury.differentSearch") : t("treasury.noEntries")}
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("common.description")}</th>
                    <th scope="col">{t("common.date")}</th>
                    <th scope="col">{t("common.category")}</th>
                    <th scope="col">{t("common.event")}</th>
                    <th scope="col">{t("common.reference")}</th>
                    <th scope="col">{t("treasury.recordedBy")}</th>
                    <th scope="col">{t("treasury.source")}</th>
                    <th scope="col">{t("common.type")}</th>
                    <th scope="col" className="amount-cell">{t("common.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td><strong>{entry.description}</strong></td>
                      <td>{fmt.date(entry.occurredAt)}</td>
                      <td>{entry.category ?? "—"}</td>
                      <td>{entry.eventTitle ?? "—"}</td>
                      <td>{entry.reference ?? "—"}</td>
                      <td>{entry.recordedByName ?? (entry.sourceType === "opening_balance" ? t("treasury.systemOpeningBalance") : t("treasury.unknownOfficer"))}</td>
                      <td>{entry.sourceId ? <a href={`/api/ledger/entries/${encodeURIComponent(entry.id)}/source`}
                        onClick={event => { event.preventDefault(); if (!sourceBusy) void showSource(entry.id); }}>
                        {entry.sourceType} · {entry.sourceId}
                      </a> : t("treasury.openingBalance")}</td>
                      <td>
                        <span className={`badge ${entry.type === "income" ? "green" : "neutral"}`}>
                          {entry.type === "income" ? t("treasury.income") : t("treasury.expensePaid")}
                        </span>
                      </td>
                      <td className={`amount-cell ${entry.type === "income" ? "positive" : ""}`}>
                        {entry.type === "income" ? "+" : "−"}
                        {fmt.currency(entry.amountPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <PreviewNote>{t("treasury.preview")}</PreviewNote>
    </div>
  );
}

function EventReportCard({ eventId }: { eventId: string }) {
  const { t, fmt } = useI18n();
  const messages = useRequestMessages();
  const [report, setReport] = useState<EventReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}/report`, { cache: "no-store" });
      if (!response.ok) throw new Error(messages.current("report.unavailable"));
      setReport(await response.json() as EventReport);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : messages.current("report.unavailable"));
    }
  }, [eventId, messages]);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return <p className="event-report-error" role="alert">{error} <button type="button" className="text-button" onClick={() => void load()}>{t("common.retry")}</button></p>;
  }
  if (!report) return <div className="event-report-loading" role="status">{t("report.loading")}</div>;

  return (
    <div className="event-report" aria-label={t("report.ariaLabel", { title: report.eventTitle })}>
      <div className="event-report-heading">
        <span className="eyebrow">{t("report.kicker")}</span>
        <span className={`badge ${report.fundraiser.onTrack ? "green" : "amber"}`}>
          {report.fundraiser.onTrack ? t("report.onTrack") : t("report.needsAttention")}
        </span>
      </div>
      <div className="report-progress-label">
        <span>{t("report.progress", { raised: fmt.currency(report.fundraiser.raisedPaise), goal: fmt.currency(report.fundraiser.goalPaise) })}</span>
        <strong>{report.fundraiser.percent}%</strong>
      </div>
      <div className="capacity-bar report-bar"><span style={{ width: `${Math.min(100, Math.max(0, report.fundraiser.percent))}%` }} /></div>
      <div className="report-task-summary">
        <span>{t("report.tasks", { count: report.tasks.total })}</span>
        <span>{t("report.done", { count: report.tasks.done })}</span>
        <span>{t("report.inProgress", { count: report.tasks.inProgress })}</span>
        <span className={report.tasks.overdue > 0 ? "overdue-text" : ""}>{t("report.overdue", { count: report.tasks.overdue })}</span>
      </div>
    </div>
  );
}

function SubscriptionSection({
  notice,
  onBack,
  onStart,
}: {
  notice: string;
  onBack: () => void;
  onStart: (plan: "starter" | "pro", period: "monthly" | "yearly") => void;
}) {
  return (
    <section className="subscription-page" aria-labelledby="subscription-title">
      <div className="subscription-intro">
        <button type="button" className="text-button" onClick={onBack}>← Back to overview</button>
        <div className="eyebrow">MODE PLANS / CLUB OPERATIONS</div>
        <h2 id="subscription-title">Give your club<br /><span>more room to move.</span></h2>
        <p>Pick the level of support that fits your team today. Change plans whenever your club grows.</p>
      </div>
      <PricingInteraction starterMonth={9.99} starterAnnual={7.49} proMonth={19.99} proAnnual={17.49} onStart={onStart} />
      {notice && <p className="subscription-notice" role="status">{notice}</p>}
    </section>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { t, fmt, apiError } = useI18n();
  const messages = useRequestMessages();
  const [section, setSection] = useState<Section>("overview");
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
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [subscriptionNotice, setSubscriptionNotice] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [savingTaskIds, setSavingTaskIds] = useState<string[]>([]);
  const pendingTaskIds = useRef(new Set<string>());
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [todoTaskOrder, setTodoTaskOrder] = useState<string[]>([]);
  const nameInput = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const refreshDashboard = useCallback(async () => {
    setRefreshError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Dashboard refresh failed.");
      setData((await response.json()) as Dashboard);
    } catch {
      setRefreshError(messages.current("workspace.refreshFailed"));
    }
  }, [messages]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error(messages.current("workspace.loadFailed"));
      setData((await response.json()) as Dashboard);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : messages.current("workspace.loadFailedShort"));
    } finally {
      setLoading(false);
    }
  }, [messages]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data) return;
    const ids = data.tasks.filter((task) => task.status === "todo").map((task) => task.id);
    setTodoTaskOrder((current) => {
      const next = [
        ...current.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !current.includes(id)),
      ];
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [data]);
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
      const next = sectionFromHash[hash];
      if (next) setSection(next);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function openMembers() {
    setSection("members");
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
      const result = (await response.json()) as { member?: Member; error?: string; code?: string };
      if (!response.ok) throw new Error(apiError(result, "members.addFailed"));
      setSuccess(t("members.added", { name: result.member?.name ?? t("members.fallbackName") }));
      form.reset();
      setShowForm(false);
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : t("members.addFailed"));
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
      if (!response.ok) throw new Error(apiError(result, "tasks.statusFailed"));
      setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, status: result.status } : item) } : current);
    } catch (error) {
      setTaskErrors(current => ({ ...current, [task.id]: error instanceof Error ? error.message : t("tasks.statusFailed") }));
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
  const roleLabel = t(`roles.${user.role}`);
  const themeLabel = isDark ? t("topbar.lightTheme") : t("topbar.darkTheme");
  const sectionLabel = section === "subscription" ? "Subscription" : t(`nav.${section as Exclude<Section, "subscription">}`);
  const sectionDescription = section === "subscription" ? "Choose a plan that fits the way your club works." : t(`desc.${section as Exclude<Section, "subscription">}`);
  const workspaceResults = workspaceSearch.trim()
    ? [
        ...(data?.tasks.filter((task) => `${task.title} ${task.assignee}`.toLowerCase().includes(workspaceSearch.trim().toLowerCase())).map((task) => ({ label: task.title, detail: task.assignee || t("common.unassigned"), target: "tasks" as const })) ?? []),
        ...(data?.members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(workspaceSearch.trim().toLowerCase())).map((member) => ({ label: member.name, detail: member.email, target: "members" as const })) ?? []),
        ...(data?.events.filter((event) => `${event.title} ${event.venue}`.toLowerCase().includes(workspaceSearch.trim().toLowerCase())).map((event) => ({ label: event.title, detail: event.venue, target: "events" as const })) ?? []),
        ...(data?.announcements.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(workspaceSearch.trim().toLowerCase())).map((item) => ({ label: item.title, detail: t("nav.announcements"), target: "announcements" as const })) ?? []),
      ].slice(0, 6)
    : [];

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        {t("app.skipToContent")}
      </a>
      {isNavOpen && <button className="nav-scrim" type="button" aria-label={t("nav.close")} onClick={() => setIsNavOpen(false)} />}
      <aside className={`sidebar ${isNavOpen ? "mobile-open" : ""}`} aria-label={t("nav.workspaceNavigation")}>
        <a className="brand" href="/" aria-label={t("app.brandHome")}>
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
            <small>{t("nav.studentOrganization")}</small>
          </span>
        </div>
        <p className="nav-caption">{t("nav.caption")}</p>
        <nav aria-label={t("nav.mainNavigation")}>
          {navigation.filter(item => (item.id !== "treasury" || user.permissions.includes("ledger:read")) && (item.id !== "members" || user.permissions.includes("members:read"))).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${section === item.id ? "active" : ""}`}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => { setSection(item.id); setSuccess(""); setIsNavOpen(false); }}
            >
              <Icon name={item.icon} />
              <span>{t(`nav.${item.id}`)}</span>
              {item.id === "members" && data && (
                <span className="nav-count">{data.metrics.members}</span>
              )}
              {item.id === "tasks" && data && openTasks.length > 0 && (
                <span className="nav-count">{openTasks.length}</span>
              )}
            </button>
          ))}
          <a className="nav-item" href="/pass" onClick={() => setIsNavOpen(false)}>
            <Icon name="coin" />
            <span>My pass</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-star">✳</span>
            <h3>
              {t("nav.noteTitleLine1")}
              <br />
              {t("nav.noteTitleLine2")}
            </h3>
            <p>{t("nav.noteBody")}</p>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{clubInitials}</span>
            <span>
              <strong>{t("nav.demoWorkspace")}</strong>
              <small>{t("nav.signedInAs", { role: roleLabel })}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label={t("nav.open")} onClick={() => setIsNavOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            {t("app.workspace")} <Icon name="chevron" size={13} />
            <span>{sectionLabel}</span>
          </div>
          <div className="workspace-search-wrap">
            <label className="workspace-search">
              <Icon name="search" size={15} />
              <input
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
                placeholder="Search workspace"
                aria-label="Search workspace"
              />
            </label>
            {workspaceSearch.trim() && (
              <div className="workspace-search-results" role="listbox">
                {workspaceResults.length ? workspaceResults.map((result) => (
                  <button
                    key={`${result.target}:${result.label}`}
                    type="button"
                    role="option"
                    onClick={() => {
                      setSection(result.target);
                      setWorkspaceSearch("");
                    }}
                  >
                    <strong>{result.label}</strong>
                    <span>{result.detail}</span>
                  </button>
                )) : <p>No matching workspace records.</p>}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setIsDark((value) => !value)}
              aria-label={themeLabel}
              title={themeLabel}
            >
              <Icon name={isDark ? "sun" : "moon"} size={16} />
            </button>
            <span className="demo-indicator">
              <span />
              {t("topbar.sampleData")}
            </span>
            <div className="topbar-user-section" ref={userMenuRef}>
              <div
                className="topbar-progress-bar"
                title={`${t("topbar.tasksCompleted")}: ${completedTasks}/${totalTasks} (${taskProgressPercent}%)`}
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
                aria-label={t("topbar.accountMenu")}
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
                      <span className="dropdown-role-badge">{roleLabel}</span>
                    </div>
                  </div>
                  <div className="dropdown-progress-stats">
                    <div className="dropdown-progress-label">
                      <span>{t("topbar.tasksCompleted")}</span>
                      <b>{completedTasks}/{totalTasks} ({taskProgressPercent}%)</b>
                    </div>
                    <div className="dropdown-progress-bar">
                      <div className="dropdown-progress-fill" style={{ width: `${taskProgressPercent}%` }} />
                    </div>
                  </div>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-subscription-btn"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setSubscriptionNotice("");
                      setSection("subscription");
                    }}
                  >
                    <span aria-hidden="true">✦</span>
                    <span>Subscription</span>
                    <small>Plans &amp; billing</small>
                  </button>
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
                    <span>{t("nav.signOut")}</span>
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
                {clubName.toUpperCase()} <span>/</span> {t("hero.workspaceKicker")}
              </div>
              <h1>
                {section === "overview" ? (
                  <>
                    {t("hero.titleLine1")} <span>{t("hero.titleLine2")}</span>
                  </>
                ) : (
                  sectionLabel
                )}
              </h1>
              <p>{sectionDescription}</p>
            </div>
            {user.permissions.includes("members:create") && (section === "overview" || section === "members") && (
              <ShinyButton
                className="button primary"
                type="button"
                onClick={openMembers}
                disabled={loading || !!error}
              >
                <Icon name="plus" size={18} />
                {t("members.addMember")}
              </ShinyButton>
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
              <button className="text-button" type="button" onClick={() => void refreshDashboard()}>{t("workspace.retryRefresh")}</button>
            </div>
          )}
          {loading && <WorkspaceMainSkeleton />}
          {!loading && error && (
            <div className="error-state" role="alert">
              <h2>{t("workspace.errorTitle")}</h2>
              <p>{error}</p>
              <button className="button primary" type="button" onClick={() => void load()}>
                {t("workspace.retryLoading")}
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {section === "subscription" && (
                <SubscriptionSection
                  notice={subscriptionNotice}
                  onBack={() => { setSubscriptionNotice(""); setSection("overview"); }}
                  onStart={(plan, period) => setSubscriptionNotice(`${plan === "pro" ? "Pro" : "Starter"} ${period} selected. Checkout will be available here soon.`)}
                />
              )}
              {/* ── Overview ─────────────────────────────────────────────── */}
              {section === "overview" && (
                <>
                  <section className="metrics-grid" aria-label={t("overview.glance")}>
                    <Metric
                      label={t("overview.totalMembers")}
                      value={String(data.metrics.members)}
                      detail={t("overview.activeMemberships", { count: data.metrics.activeMembers })}
                      icon="people"
                      color="lavender"
                    />
                    <Metric
                      label={t("overview.upcomingEvents")}
                      value={String(data.metrics.upcomingEvents).padStart(2, "0")}
                      detail={t("overview.upcomingDetail")}
                      icon="calendar"
                      color="peach"
                    />
                    <Metric
                      label={t("overview.openTasks")}
                      value={String(openTasks.length).padStart(2, "0")}
                      detail={t("overview.tasksCompleted", { count: data.tasks.filter((task) => task.status === "done").length })}
                      icon="check"
                      color="mint"
                    />
                    <Metric
                      label={t("overview.clubBalance")}
                      value={fmt.currency(data.metrics.balancePaise)}
                      detail={t("overview.balanceDetail")}
                      icon="wallet"
                      color="dark"
                    />
                  </section>

                  <div className="overview-grid">
                    <section className="panel events-panel">
                      <PanelHeading
                        kicker={t("overview.eventsKicker")}
                        title={t("overview.eventsTitle")}
                        action={t("overview.allEvents")}
                        onClick={() => setSection("events")}
                      />
                      {data.events.length ? (
                        <div className="event-list">
                          {data.events.slice(0, 2).map((event, index) => (
                            <article className="event-row" key={event.id}>
                              <div className={`date-tile ${index % 2 ? "purple" : "coral"}`}>
                                <span>{fmt.month(event.startsAt)}</span>
                                <strong>{fmt.day(event.startsAt)}</strong>
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
                                    {t("overview.registered", { registered: event.registered, capacity: event.capacity })}
                                  </span>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Empty title={t("overview.eventsEmptyTitle")}>{t("overview.eventsEmptyBody")}</Empty>
                      )}
                      <div className="panel-footnote">
                        <span className="tiny-dot" />
                        {t("overview.eventsFootnote")}
                      </div>
                    </section>
                    <section className="panel tasks-panel">
                      <PanelHeading
                        kicker={t("tasks.overviewKicker")}
                        title={t("tasks.overviewTitle")}
                        action={t("tasks.viewAll")}
                        onClick={() => setSection("tasks")}
                      />
                      {data.tasks.length ? (
                        <div className="dashboard-kanban" aria-label={t("tasks.overviewTitle")}>
                          {dashboardTaskStatuses.map((status) => {
                            const tasks = data.tasks
                              .filter((task) => task.status === status)
                              .sort((a, b) => {
                                if (status !== "todo") return 0;
                                return (todoTaskOrder.indexOf(a.id) === -1 ? Number.MAX_SAFE_INTEGER : todoTaskOrder.indexOf(a.id))
                                  - (todoTaskOrder.indexOf(b.id) === -1 ? Number.MAX_SAFE_INTEGER : todoTaskOrder.indexOf(b.id));
                              });
                            return <section className={`dashboard-kanban-column ${status} ${draggedTaskId ? "is-drop-target" : ""}`} key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropDashboardTask(event, status)}>
                              <header><span className={`status-dot ${status}`} aria-hidden="true" /><span>{t(`tasks.status.${status}`)}</span><b>{tasks.length}</b></header>
                              <div className="dashboard-kanban-cards">
                                {tasks.length ? status === "todo" ? (
                                  <ReorderList
                                    items={tasks}
                                    getId={(task) => task.id}
                                    getLabel={(task) => task.title}
                                    onReorder={(next) => setTodoTaskOrder(next.map((task) => task.id))}
                                    onLongPress={(task) => moveDashboardTask(task, "done")}
                                    onExternalDragStart={(task) => setDraggedTaskId(task.id)}
                                    onExternalDragEnd={() => setDraggedTaskId(null)}
                                    label={t("tasks.status.todo")}
                                    disabled={false}
                                    itemClassName="dashboard-reorder-item"
                                    showGrip={false}
                                  >
                                    {(task) => (
                                      <div>
                                        <div className={`dashboard-task-card ${savingTaskIds.includes(task.id) ? "completing" : ""}`} title={t("tasks.dragHint")}>
                                          <span className="dashboard-task-title">{task.title}</span>
                                          <span className="dashboard-task-assignee">{savingTaskIds.includes(task.id) ? t("tasks.saving") : task.assignee || t("common.unassigned")}</span>
                                        </div>
                                        {taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}
                                      </div>
                                    )}
                                  </ReorderList>
                                ) : tasks.map((task) => <div key={task.id}><button type="button" disabled={savingTaskIds.includes(task.id) || (!user.permissions.includes("tasks:write") && task.assigneeId !== user.id)} draggable={!savingTaskIds.includes(task.id) && (user.permissions.includes("tasks:write") || task.assigneeId === user.id)} className={`dashboard-task-card ${task.status === "done" ? "completed" : ""} ${savingTaskIds.includes(task.id) ? "completing" : ""}`} onClick={() => moveDashboardTask(task, task.status === "done" ? "todo" : "done")} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id); setDraggedTaskId(task.id); }} onDragEnd={() => setDraggedTaskId(null)} title={t("tasks.dragHint")}><span className="dashboard-task-title">{task.title}</span><span className="dashboard-task-assignee">{savingTaskIds.includes(task.id) ? t("tasks.saving") : task.assignee || t("common.unassigned")}</span></button>{taskErrors[task.id] && <p role="alert" className="error-text">{taskErrors[task.id]}</p>}</div>) : <p className="dashboard-kanban-empty">{t("tasks.columnEmpty")}</p>}
                              </div>
                            </section>;
                          })}
                        </div>
                      ) : (
                        <Empty title={t("tasks.overviewEmptyTitle")}>{t("tasks.overviewEmptyBody")}</Empty>
                      )}
                    </section>
                  </div>

                  <div className="overview-bottom">
                    <section className="panel members-panel">
                      <PanelHeading
                        kicker={t("members.overviewKicker")}
                        title={t("members.overviewTitle")}
                        action={t("members.allMembers")}
                        onClick={() => setSection("members")}
                      />
                      <MemberTable members={data.members.slice(0, 4)} />
                    </section>
                    <section className="notice-card">
                      <span className="notice-icon">
                        <Icon name="megaphone" size={23} />
                      </span>
                      <div className="eyebrow">{t("overview.noticeKicker")}</div>
                      {data.announcements[0] ? (
                        <>
                          <h2>{data.announcements[0].title}</h2>
                          <p>{data.announcements[0].body}</p>
                          <span className="notice-date">{fmt.date(data.announcements[0].publishedAt)}</span>
                        </>
                      ) : (
                        <>
                          <h2>{t("overview.noticeEmptyTitle")}</h2>
                          <p>{t("overview.noticeEmptyBody")}</p>
                        </>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setSection("announcements")}
                      >
                        {t("overview.readAnnouncements")} <Icon name="arrow" size={17} />
                      </button>
                    </section>
                  </div>
                </>
              )}

              {/* ── Members ──────────────────────────────────────────────── */}
              {section === "members" && (
                <>
                  {showForm && (
                    <section
                      className="panel member-form-panel"
                      aria-labelledby="member-form-heading"
                    >
                      <div className="form-heading">
                        <div>
                          <h2 id="member-form-heading">{t("members.formTitle")}</h2>
                          <p>{t("members.formBody")}</p>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={t("members.closeForm")}
                          onClick={() => setShowForm(false)}
                          disabled={saving}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                      <form onSubmit={addMember}>
                        <div className="form-fields">
                          <label>
                            {t("members.fullName")}
                            <input
                              ref={nameInput}
                              name="name"
                              placeholder={t("members.namePlaceholder")}
                              autoComplete="name"
                              minLength={2}
                              maxLength={120}
                              required
                              disabled={saving}
                            />
                          </label>
                          <label>
                            {t("members.email")}
                            <input
                              name="email"
                              type="email"
                              placeholder={t("members.emailPlaceholder")}
                              autoComplete="email"
                              maxLength={254}
                              required
                              disabled={saving}
                            />
                          </label>
                          <button type="submit" className="button primary" disabled={saving}>
                            {saving ? t("members.adding") : t("members.addToDirectory")}
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
                      title={t("members.directoryTitle")}
                      kicker={t("members.directoryKicker", { members: data.metrics.members, active: data.metrics.activeMembers })}
                    />
                    <MemberTable members={data.members} />
                  </section>
                  <PreviewNote>{t("members.preview")}</PreviewNote>
                </>
              )}

              {/* ── Events ───────────────────────────────────────────────── */}
              {section === "events" && (
                <>
                  <div className="event-cards">
                    {data.events.map((event) => (
                      <article key={event.id} className="panel event-card">
                        <div className="event-card-top">
                          <div className="date-tile coral">
                            <span>{fmt.month(event.startsAt)}</span>
                            <strong>{fmt.day(event.startsAt)}</strong>
                          </div>
                          <span className="badge neutral">{t("events.recorded")}</span>
                        </div>
                        <h2>{event.title}</h2>
                        <p>
                          {event.venue} · {fmt.date(event.startsAt)}
                        </p>
                        <div className="capacity-bar">
                          <span
                            style={{
                              width: `${event.capacity > 0 ? Math.min(100, (event.registered / event.capacity) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className="event-numbers">
                          <span>{t("events.registeredCount", { count: event.registered })}</span>
                          <span>{t("events.capacityCount", { count: event.capacity })}</span>
                        </div>
                        <div className="ticket-prices">
                          <div>
                            <span>{t("events.memberTicket")}</span>
                            <strong>{fmt.currency(event.memberPricePaise)}</strong>
                          </div>
                          <div>
                            <span>{t("events.guestTicket")}</span>
                            <strong>{fmt.currency(event.guestPricePaise)}</strong>
                          </div>
                        </div>
                        {user.permissions.includes("events:report") && <EventReportCard eventId={event.id} />}
                      </article>
                    ))}
                  </div>
                  {!data.events.length && (
                    <section className="panel">
                      <Empty title={t("events.emptyTitle")}>{t("events.emptyBody")}</Empty>
                    </section>
                  )}
                  <PreviewNote>{t("events.preview")}</PreviewNote>
                </>
              )}

              {/* ── Announcements ─────────────────────────────────────────── */}
              {section === "announcements" && (
                <>
                  <div className="communication-toolbar">
                    <div>
                      <div className="eyebrow">{t("announcements.archiveKicker")}</div>
                      <p className="communication-count">
                        {t("announcements.count", { visible: visibleAnnouncements.length, total: data.announcements.length })}
                      </p>
                    </div>
                    <label className="search-field">
                      <span className="sr-only">{t("announcements.search")}</span>
                      <input
                        type="search"
                        value={announcementQuery}
                        placeholder={t("announcements.searchPlaceholder")}
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
                          <span className="eyebrow">{fmt.date(item.publishedAt)}</span>
                          <h2>{item.title}</h2>
                          <details className="announcement-details">
                            <summary>{t("announcements.read")}</summary>
                            <p>{item.body}</p>
                          </details>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!visibleAnnouncements.length && (
                    <section className="panel">
                      <Empty title={data.announcements.length ? t("announcements.noMatch") : t("announcements.quiet")}>
                        {data.announcements.length ? t("announcements.differentSearch") : t("announcements.none")}
                      </Empty>
                    </section>
                  )}
                  <PreviewNote>{t("announcements.preview")}</PreviewNote>
                </>
              )}

              {/* ── Merchandise ───────────────────────────────────────────── */}
              {section === "merchandise" && (
                <MerchandiseShop user={user} />
              )}

              {/* ── Tasks ────────────────────────────────────────────────── */}
              {section === "tasks" && <TaskBoard members={data.members} events={data.events} user={user} onChanged={refreshDashboard} />}

              {/* ── My Expenses ───────────────────────────────────────────── */}
              {section === "expenses" && <MyExpenses user={user} events={data.events} />}

              {/* ── Treasury ─────────────────────────────────────────────── */}
              {section === "treasury" && user.permissions.includes("ledger:read") && <Treasury onChanged={refreshDashboard} />}
            </>
          )}

          <footer className="workspace-footer">
            <span>
              <span className="footer-dot" />
              {t("workspace.footerBrand")}
            </span>
            <p>{t("workspace.footerNote")}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const messages = useRequestMessages();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then(async response => {
      if (response.ok) { const result = await response.json(); if (active) setUser(result.user); }
      else if (response.status !== 401) throw new Error(messages.current("auth.sessionFailed"));
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [messages]);
  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(t("auth.signOutFailed"));
      setUser(null);
    } catch (error) { setError(error instanceof Error ? error.message : t("auth.signOutFailed")); }
  }
  if (loading) return <main className="loading-state" role="status">{t("auth.loading")}</main>;
  if (user) return <>{error && <p role="alert">{error}</p>}<Workspace key={user.id} user={user} onLogout={() => void signOut()} /></>;
  return <LandingPage onSignIn={() => { window.location.href = "/app/login"; }} />;
}
