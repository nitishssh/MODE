import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entrance scan. 200 on first valid scan; 404 unknown; 409 cancelled, unpaid or already used. */
export const POST = route<{ code: string }>("ticket check-in", (request, { code }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "tickets:check_in", mutation: true });
  return json(db.events.checkIn(actor, decodeURIComponent(code)));
});
