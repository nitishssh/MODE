import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's tickets, including QR tokens, newest first. */
export const GET = route("my tickets", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ tickets: db.events.myTickets(actor) });
});
