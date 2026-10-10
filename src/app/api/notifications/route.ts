import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's in-app notifications, newest first. */
export const GET = route("notifications", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ notifications: db.dues.notificationsFor(actor) });
});
