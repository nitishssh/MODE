import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { taskStatusSchema } from "../../../../../lib/modules/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The assignee or an officer moves a task between todo, in_progress and done. */
export const POST = route<{ id: string }>("task status", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const { status } = await readJson(request, taskStatusSchema);
  return json({ task: db.tasks.setStatus(actor, id, status) });
});
