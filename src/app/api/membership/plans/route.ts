import { optionalActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public price list so prospective members can see plans before signing up. */
export const GET = route("plan list", (request) => {
  const db = getDatabase();
  const clubId = optionalActor(request, db)?.clubId ?? DEFAULT_CLUB_ID;
  return json({ plans: db.membership.listPlans(clubId) });
});
