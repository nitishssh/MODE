import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { joinClubSchema } from "../../../../lib/modules/identity";
import type { JoinClubResponse } from "../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in person joins a club with its join code, as a plain member. */
export const POST = route("club join", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const input = await readJson(request, joinClubSchema);
  const result = db.joinClub(actor, input.joinCode);
  return json(result satisfies JoinClubResponse, { status: result.rejoined ? 200 : 201 });
});
