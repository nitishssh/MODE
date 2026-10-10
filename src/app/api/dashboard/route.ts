import { optionalActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public overview; member emails and finance appear only for authorized sessions. */
export const GET = route("dashboard read", (request) => {
  const db = getDatabase();
  return json(db.getDashboard(optionalActor(request, db)));
});
