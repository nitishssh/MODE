import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { switchClubSchema } from "../../../../lib/modules/identity";
import { toSessionUser } from "../_shared";
import type { AuthMeResponse } from "../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Make another of the caller's clubs the active one for this session (cookie or bearer). */
export const POST = route("club switch", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const input = await readJson(request, switchClubSchema);
  const next = db.switchClub(actor, input.clubId);
  return json({ user: toSessionUser(next), pass: db.getPass(next.memberId), memberships: db.listMemberships(next.personId) } satisfies AuthMeResponse);
});
