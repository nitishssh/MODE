import { optionalActor, requireActor } from "../../../lib/auth/authorize";
import { hasPermission } from "../../../lib/auth/permissions";
import { getDatabase } from "../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../lib/db/migrations";
import { json, readJson, route } from "../../../lib/http";
import { createEventSchema } from "../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Published events for everyone; organizers also see drafts and cancelled events. */
export const GET = route("event list", (request) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const includeUnpublished = actor !== null && hasPermission(actor.role, "events:write");
  return json({ events: db.events.listEvents(actor?.clubId ?? DEFAULT_CLUB_ID, { includeUnpublished }) });
});

export const POST = route("event creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:write", mutation: true });
  const input = await readJson(request, createEventSchema);
  return json({ event: db.events.createEvent(actor, input) }, { status: 201 });
});
