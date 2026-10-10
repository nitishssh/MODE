import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer view of one member's membership status and history. */
export const GET = route<{ id: string }>("member membership", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:read" });
  db.requireMember(actor.clubId, id);
  return json({ membership: db.membership.statusFor(actor.clubId, id) });
});
