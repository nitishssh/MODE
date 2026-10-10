import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { confirmBookingSchema } from "../../../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer confirms a verified payment; 201 issues the ticket, 200 replays the same reference. */
export const POST = route<{ id: string }>("booking confirmation", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "payments:confirm", mutation: true });
  const input = await readJson(request, confirmBookingSchema);
  const result = db.events.confirmBooking(actor, id, input);
  return json(result, { status: result.created ? 201 : 200 });
});
