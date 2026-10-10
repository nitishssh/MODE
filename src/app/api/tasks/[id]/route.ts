import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { taskUpdateSchema } from "../../../../lib/modules/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("task detail", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ task: db.tasks.requireTask(actor.clubId, id) });
});

/** Officers change title, description, assignee, event or deadline. */
export const PATCH = route<{ id: string }>("task update", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "tasks:write", mutation: true });
  const input = await readJson(request, taskUpdateSchema);
  return json({ task: db.tasks.update(actor, id, input) });
});
