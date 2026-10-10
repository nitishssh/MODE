import { hasPermission } from "../../../../lib/auth/permissions";
import { optionalActor, requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { NotFoundError } from "../../../../lib/errors";
import { json, readJson, route } from "../../../../lib/http";
import { announcementUpdateSchema } from "../../../../lib/modules/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("announcement detail", (request, { id }) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const announcement = db.announcements.requireAnnouncement(actor?.clubId ?? DEFAULT_CLUB_ID, id);
  if (announcement.status !== "published" && !(actor && hasPermission(actor.role, "announcements:write"))) throw new NotFoundError("Announcement not found.");
  return json({ announcement });
});

export const PATCH = route<{ id: string }>("announcement update", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "announcements:write", mutation: true });
  const input = await readJson(request, announcementUpdateSchema);
  return json({ announcement: db.announcements.updateDraft(actor, id, input) });
});
