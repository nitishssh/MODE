import { optionalActor, requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../lib/db/migrations";
import { json, readJson, route } from "../../../lib/http";
import { publishAnnouncementSchema } from "../../../lib/modules/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("announcement archive", (request) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  return json({ announcements: db.announcements.listPublished(actor?.clubId ?? DEFAULT_CLUB_ID) });
});

export const POST = route("announcement publication", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "announcements:write", mutation: true });
  const result = db.announcements.publish(actor, await readJson(request, publishAnnouncementSchema));
  return json(result, { status: result.created ? 201 : 200 });
});
