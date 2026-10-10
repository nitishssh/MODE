import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { toSessionUser } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("session lookup", (request) => {
  const actor = requireActor(request, getDatabase());
  return json({ user: toSessionUser(actor) });
});
