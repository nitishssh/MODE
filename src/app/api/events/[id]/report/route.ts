import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tickets sold, attendance and realized revenue from the ledger. */
export const GET = route<{ id: string }>("event report", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:report" });
  return json(db.events.eventReport(actor, id));
});
