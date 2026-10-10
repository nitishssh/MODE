import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner or organizer cancels a booking and releases the seat. */
export const POST = route<{ id: string }>("booking cancellation", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  return json({ booking: db.events.cancelBooking(actor, id) });
});
