import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { rosterFilterSchema } from "../../../../lib/modules/membership";
import { parseInput } from "../../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer roster with membership state per member; `?state=active|expired|never`. */
export const GET = route("membership roster", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:read" });
  const filter = parseInput(rosterFilterSchema, { state: new URL(request.url).searchParams.get("state") ?? undefined });
  const roster = db.membership.roster(actor, filter);
  const counts = { active: 0, expired: 0, never: 0 };
  for (const entry of db.membership.roster(actor)) counts[entry.state] += 1;
  return json({ counts, roster });
});
