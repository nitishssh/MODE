import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delivery counts by status for one announcement; never lists recipients. */
export const GET = route<{ id: string }>("announcement delivery", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "announcements:write" });
  return json({ delivery: db.announcements.deliverySummary(actor, id) });
});
