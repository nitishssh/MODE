import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, readJson, route } from "../../../lib/http";
import { taskFilterSchema, taskInputSchema } from "../../../lib/modules/tasks";
import { parseInput } from "../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Task board for signed-in members. Filters: status, assigneeId, eventId, overdue=true, mine=true. */
export const GET = route("task list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const params = new URL(request.url).searchParams;
  if (params.get("mine") === "true") return json({ tasks: db.tasks.mine(actor) });
  const filter = parseInput(taskFilterSchema, {
    status: params.get("status") ?? undefined,
    assigneeId: params.get("assigneeId") ?? undefined,
    eventId: params.get("eventId") ?? undefined,
    overdue: params.get("overdue") ?? undefined,
  });
  return json({ tasks: db.tasks.list(actor.clubId, filter) });
});

export const POST = route("task creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "tasks:write", mutation: true });
  const input = await readJson(request, taskInputSchema);
  return json({ task: db.tasks.create(actor, input) }, { status: 201 });
});
