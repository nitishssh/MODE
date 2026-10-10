import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer view of every ticket for an event (expired holds released first). */
export const GET = route<{ id: string }>("event tickets", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "payments:confirm" });
  return json({ tickets: db.events.eventTickets(actor, id) });
});

/** Signed-in member books one seat; price fixed from membership state now. Hold lasts 30 minutes. */
export const POST = route<{ id: string }>("member booking", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "bookings:create", mutation: true });
  return json({ ticket: db.events.bookTicket(actor, id) }, { status: 201 });
});
