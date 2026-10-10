import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reserve one seat for the signed-in member at the correct member/guest price. */
export const POST = route<{ id: string }>("event booking", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "bookings:create", mutation: true });
  return json({ booking: db.events.bookEvent(actor, id) }, { status: 201 });
});
