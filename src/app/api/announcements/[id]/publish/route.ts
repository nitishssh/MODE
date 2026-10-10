import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { publishSchema } from "../../../../../lib/modules/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publish to the website archive and queue member notifications; repeat calls queue nothing new. */
export const POST = route<{ id: string }>("announcement publish", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "announcements:write", mutation: true });
  const hasBody = request.headers.get("content-type")?.includes("application/json") ?? false;
  const input = hasBody ? await readJson(request, publishSchema) : {};
  const result = db.announcements.publish(actor, id, input);
  return json(result, { status: result.firstPublish ? 201 : 200 });
});
