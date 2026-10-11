import { requireActor } from "../../../../../lib/auth/authorize";
import { clearedSessionCookie } from "../../../../../lib/auth/session";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";
import type { LeaveClubResponse } from "../../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in person leaves one of their clubs; history stays, access ends. */
export const POST = route<{ id: string }>("club leave", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const result = db.leaveClub(actor, id);
  // Leaving the last club ends the session; a cookie session is cleared too (bearer clients drop their token).
  const headers = result.signedOut && !request.headers.has("authorization") ? { "Set-Cookie": clearedSessionCookie() } : undefined;
  return json(result satisfies LeaveClubResponse, { headers });
});
