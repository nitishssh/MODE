import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's own bookings and tickets. */
export const GET = route("own bookings", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ bookings: db.events.myBookings(actor) });
});
