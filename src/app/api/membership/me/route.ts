import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in member's own membership status and history. */
export const GET = route("own membership", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ membership: db.membership.statusFor(actor.clubId, actor.memberId) });
});
