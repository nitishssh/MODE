import { optionalActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("announcement detail", (request, { id }) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  return json({ announcement: db.announcements.getPublished(actor?.clubId ?? DEFAULT_CLUB_ID, id) });
});
