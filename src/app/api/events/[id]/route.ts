import { hasPermission } from "../../../../lib/auth/permissions";
import { optionalActor, requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { NotFoundError } from "../../../../lib/errors";
import { json, readJson, route } from "../../../../lib/http";
import { eventUpdateSchema } from "../../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("event detail", (request, { id }) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const event = db.events.requireEvent(actor?.clubId ?? DEFAULT_CLUB_ID, id);
  if (event.status !== "published" && !(actor && hasPermission(actor.role, "events:write"))) throw new NotFoundError("Event not found.");
  return json({ event });
});

export const PATCH = route<{ id: string }>("event update", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:write", mutation: true });
  const input = await readJson(request, eventUpdateSchema);
  return json({ event: db.events.updateEvent(actor, id, input) });
});
