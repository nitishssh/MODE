import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dues history for one member. */
export const GET = route<{ id: string }>("member dues", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:read" });
  db.requireMember(actor.clubId, id);
  return json({ payments: db.dues.paymentsFor(actor.clubId, id) });
});
