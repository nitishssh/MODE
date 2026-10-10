import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { TaskDetails } from "../contracts";
import { hasPermission } from "../auth/permissions";
import { nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ForbiddenError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";

const STATUSES = ["todo", "in_progress", "done"] as const;

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).default(""),
    assigneeId: z.string().min(1).nullable().default(null),
    eventId: z.string().min(1).nullable().default(null),
    dueAt: z.string().datetime({ offset: true }).nullable().default(null),
    status: z.enum(STATUSES).default("todo"),
  })
  .strict();
/** Update schema has no defaults: an omitted field must leave the stored value unchanged. */
export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000),
    assigneeId: z.string().min(1).nullable(),
    eventId: z.string().min(1).nullable(),
    dueAt: z.string().datetime({ offset: true }).nullable(),
  })
  .partial()
  .strict();
export const taskStatusSchema = z.object({ status: z.enum(STATUSES) }).strict();
export const taskFilterSchema = z.object({
  status: z.enum(STATUSES).optional(),
  assigneeId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  overdue: z.enum(["true", "false"]).optional(),
});

const TASK_SELECT = "SELECT t.*, ev.title AS event_title FROM tasks t LEFT JOIN events ev ON ev.id = t.event_id";

export function createTasksModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;

  function mapTask(row: Row): TaskDetails {
    const dueAt = nullableText(row.due_at);
    const status = row.status as TaskDetails["status"];
    return {
      id: text(row.id),
      title: text(row.title),
      assignee: text(row.assignee),
      status,
      description: text(row.description),
      assigneeId: nullableText(row.assignee_id),
      eventId: nullableText(row.event_id),
      eventTitle: nullableText(row.event_title),
      dueAt,
      overdue: dueAt !== null && status !== "done" && dueAt < ctx.now().toISOString(),
      createdBy: nullableText(row.created_by),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      completedAt: nullableText(row.completed_at),
    };
  }

  function requireTask(clubId: string, id: string): TaskDetails {
    const row = db.prepare(`${TASK_SELECT} WHERE t.club_id = ? AND t.id = ?`).get(clubId, id) as Row | undefined;
    if (!row) throw new NotFoundError("Task not found.");
    return mapTask(row);
  }

  /** Who owns what, and what is overdue. Any signed-in member may read the board. */
  function list(clubId: string, filter: z.infer<typeof taskFilterSchema> = {}): TaskDetails[] {
    const data = parseInput(taskFilterSchema, filter);
    const clauses = ["t.club_id = ?"];
    const params: string[] = [clubId];
    if (data.status) {
      clauses.push("t.status = ?");
      params.push(data.status);
    }
    if (data.assigneeId) {
      clauses.push("t.assignee_id = ?");
      params.push(data.assigneeId);
    }
    if (data.eventId) {
      clauses.push("t.event_id = ?");
      params.push(data.eventId);
    }
    if (data.overdue === "true") {
      clauses.push("t.due_at IS NOT NULL AND t.status != 'done' AND t.due_at < ?");
      params.push(ctx.now().toISOString());
    }
    const sql = `${TASK_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, COALESCE(t.due_at, '9999'), t.created_at, t.id`;
    return (db.prepare(sql).all(...params) as Row[]).map(mapTask);
  }

  /** Validate an assignee belongs to the club; returns the display name kept on the task row. */
  function resolveAssignee(clubId: string, assigneeId: string | null): { id: string | null; name: string } {
    if (assigneeId === null) return { id: null, name: "" };
    const member = identity.findMember(clubId, assigneeId);
    if (!member) throw new NotFoundError("Assignee must be a member of this club.");
    return { id: member.id, name: member.name };
  }

  function assertEvent(clubId: string, eventId: string | null): void {
    if (eventId !== null && !db.prepare("SELECT 1 FROM events WHERE club_id = ? AND id = ?").get(clubId, eventId)) {
      throw new NotFoundError("Event not found.");
    }
  }

  function create(actor: Actor, input: z.input<typeof taskInputSchema>): TaskDetails {
    assertPermission(actor, "tasks:write");
    const data = parseInput(taskInputSchema, input);
    return transaction(ctx, () => {
      const assignee = resolveAssignee(actor.clubId, data.assigneeId);
      assertEvent(actor.clubId, data.eventId);
      const id = randomUUID();
      const nowIso = ctx.now().toISOString();
      db.prepare(
        `INSERT INTO tasks (id, club_id, title, description, assignee, assignee_id, event_id, due_at, status, created_by, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        actor.clubId,
        data.title,
        data.description,
        assignee.name,
        assignee.id,
        data.eventId,
        data.dueAt ? new Date(data.dueAt).toISOString() : null,
        data.status,
        actor.memberId,
        nowIso,
        nowIso,
        data.status === "done" ? nowIso : null,
      );
      identity.recordAudit(actor, "task.created", "task", id, { assigneeId: assignee.id, eventId: data.eventId, dueAt: data.dueAt });
      return requireTask(actor.clubId, id);
    });
  }

  /** Officers edit title, description, owner, event and deadline. */
  function update(actor: Actor, id: string, input: z.infer<typeof taskUpdateSchema>): TaskDetails {
    assertPermission(actor, "tasks:write");
    const data = parseInput(taskUpdateSchema, input);
    return transaction(ctx, () => {
      const current = requireTask(actor.clubId, id);
      const assignee = data.assigneeId !== undefined ? resolveAssignee(actor.clubId, data.assigneeId) : { id: current.assigneeId, name: current.assignee };
      const eventId = data.eventId !== undefined ? data.eventId : current.eventId;
      assertEvent(actor.clubId, eventId);
      const dueAt = data.dueAt !== undefined ? (data.dueAt ? new Date(data.dueAt).toISOString() : null) : current.dueAt;
      db.prepare("UPDATE tasks SET title = ?, description = ?, assignee = ?, assignee_id = ?, event_id = ?, due_at = ?, updated_at = ? WHERE id = ?").run(
        data.title ?? current.title,
        data.description ?? current.description,
        assignee.name,
        assignee.id,
        eventId,
        dueAt,
        ctx.now().toISOString(),
        id,
      );
      identity.recordAudit(actor, "task.updated", "task", id, data);
      return requireTask(actor.clubId, id);
    });
  }

  /** The assignee or an officer moves the task between todo, in_progress and done. */
  function setStatus(actor: Actor, id: string, status: TaskDetails["status"]): TaskDetails {
    parseInput(taskStatusSchema, { status });
    return transaction(ctx, () => {
      const current = requireTask(actor.clubId, id);
      const permitted = current.assigneeId === actor.memberId || hasPermission(actor.role, "tasks:write");
      if (!permitted) throw new ForbiddenError("Only the assignee or an organizer can update this task.");
      if (current.status === status) return current;
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?").run(status, status === "done" ? nowIso : null, nowIso, id);
      identity.recordAudit(actor, "task.status_changed", "task", id, { from: current.status, to: status });
      return requireTask(actor.clubId, id);
    });
  }

  function mine(actor: Actor): TaskDetails[] {
    return list(actor.clubId, { assigneeId: actor.memberId });
  }

  return { list, requireTask, create, update, setStatus, mine };
}

export type TasksModule = ReturnType<typeof createTasksModule>;
