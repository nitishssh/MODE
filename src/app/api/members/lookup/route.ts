import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Door check: `?q=` exact email or partial name. Returns membership state with masked emails. */
export const GET = route("member lookup", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:lookup" });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return json({ matches: db.membership.lookup(actor, q) });
});
