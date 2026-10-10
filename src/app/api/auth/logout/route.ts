import { clearedSessionCookie, readSessionToken } from "../../../../lib/auth/session";
import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { assertSameOrigin } from "../../../../lib/mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route("logout", (request) => {
  const db = getDatabase();
  const bearerAuth = request.headers.has("authorization");
  if (bearerAuth) {
    requireActor(request, db, { mutation: true });
  } else {
    assertSameOrigin(request);
  }
  db.logout(readSessionToken(request));
  // A bearer request must not change an unrelated ambient browser session.
  if (bearerAuth) return json({ ok: true });
  return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
