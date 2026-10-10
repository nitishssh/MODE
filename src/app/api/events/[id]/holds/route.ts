import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pending holds awaiting officer confirmation, soonest expiry first. */
export const GET = route<{ id: string }>("pending holds", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "payments:confirm" });
  return json({ holds: db.events.pendingHolds(actor, id) });
});
