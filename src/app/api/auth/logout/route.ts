import { clearedSessionCookie, readSessionToken } from "../../../../lib/auth/session";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { assertSameOrigin } from "../../../../lib/mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route("logout", (request) => {
  assertSameOrigin(request);
  getDatabase().logout(readSessionToken(request));
  return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
