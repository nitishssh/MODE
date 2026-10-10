import { clearedSessionCookie, readSessionToken } from "../../../../lib/auth/session";
import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { assertSameOrigin } from "../../../../lib/mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route("logout", (request) => {
  const db = getDatabase();
  if (request.headers.has("authorization")) {
    requireActor(request, db, { mutation: true });
  } else {
    assertSameOrigin(request);
  }
  db.logout(readSessionToken(request));
  return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
