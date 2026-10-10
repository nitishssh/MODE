import { optionalActor, requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { json, readJson, route } from "../../../../lib/http";
import { updateEventSchema } from "../../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("event detail", (request, { id }) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  return json({ event: db.events.getEvent(actor, actor?.clubId ?? DEFAULT_CLUB_ID, id) });
});

export const PATCH = route<{ id: string }>("event update", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:write", mutation: true });
  const input = await readJson(request, updateEventSchema);
  return json({ event: db.events.updateEvent(actor, id, input) });
});
