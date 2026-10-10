import { hasPermission } from "../../../lib/auth/permissions";
import { optionalActor, requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../lib/db/migrations";
import { json, readJson, route } from "../../../lib/http";
import { announcementInputSchema } from "../../../lib/modules/announcements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public dated archive. Officers may request `?scope=all` to include drafts. */
export const GET = route("announcement list", (request) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "all" && actor && hasPermission(actor.role, "announcements:write")) {
    return json({ announcements: db.announcements.listAll(actor) });
  }
  return json({ announcements: db.announcements.listPublished(actor?.clubId ?? DEFAULT_CLUB_ID) });
});

export const POST = route("announcement draft", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "announcements:write", mutation: true });
  const input = await readJson(request, announcementInputSchema);
  return json({ announcement: db.announcements.createDraft(actor, input) }, { status: 201 });
});
