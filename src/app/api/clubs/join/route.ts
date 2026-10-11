import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { joinClubSchema } from "../../../../lib/modules/identity";
import type { ClubMembership } from "../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JoinClubInput {
  joinCode: string;
}

/** Public endpoint (rate-limited): current person adds themselves to a club via join code. */
export const POST = route("club join", async (request) => {
  const db = getDatabase();
  const input = await readJson(request, joinClubSchema);
  const membership = db.joinClub(input.joinCode);
  return json(membership as ClubMembership, { status: 201 });
});
