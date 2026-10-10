import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner cancels their own pending booking; officers with payments:confirm cancel any pending hold. */
export const POST = route<{ id: string }>("ticket cancellation", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  return json({ ticket: db.events.cancelTicket(actor, id) });
});
