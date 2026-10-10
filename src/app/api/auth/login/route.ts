import { readSessionToken } from "../../../../lib/auth/session";
import { getDatabase } from "../../../../lib/database";
import { readJson, route } from "../../../../lib/http";
import { loginSchema } from "../../../../lib/modules/identity";
import { assertSameOrigin } from "../../../../lib/mutation-guard";
import { sessionResponse } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route("login", async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, loginSchema);
  const db = getDatabase();
  const issued = db.login(input);
  // Signing in again replaces any previous session carried by this browser.
  db.logout(readSessionToken(request));
  const actor = db.getActor(issued.token);
  return sessionResponse(request, issued, actor?.clubId ?? "", 200);
});
