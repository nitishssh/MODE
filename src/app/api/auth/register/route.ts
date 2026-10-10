import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { readJson, route } from "../../../../lib/http";
import { registerSchema } from "../../../../lib/modules/identity";
import { assertSameOrigin } from "../../../../lib/mutation-guard";
import { sessionResponse } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Self-service sign-up: creates a plain `member` and signs them in. */
export const POST = route("register", async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, registerSchema);
  const issued = getDatabase().register(input);
  return sessionResponse(request, issued, DEFAULT_CLUB_ID, 201);
});
