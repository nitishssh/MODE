import { hasPermission } from "../../../lib/auth/permissions";
import { optionalActor, requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../lib/db/migrations";
import { json, readJson, route } from "../../../lib/http";
import { eventInputSchema } from "../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public programme. Organizers also see drafts and cancelled events. */
export const GET = route("event list", (request) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const includeUnpublished = actor !== null && hasPermission(actor.role, "events:write");
  return json({ events: db.events.listEvents(actor?.clubId ?? DEFAULT_CLUB_ID, { includeUnpublished }) });
});

export const POST = route("event creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:write", mutation: true });
  const input = await readJson(request, eventInputSchema);
  return json({ event: db.events.createEvent(actor, input) }, { status: 201 });
});
