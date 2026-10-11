import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { toSessionUser } from "../_shared";
import type { AuthMeResponse } from "../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SwitchClubInput {
  clubId: string;
}

export const POST = route("switch club", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const { clubId } = await request.json() as SwitchClubInput;

  // Verify the user is a member of this club
  const member = db.findMember(clubId, actor.memberId);
  if (!member) {
    return json({ error: "Not a member of this club" }, { status: 403 });
  }

  // Return the updated session with the new club
  const newActor = { ...actor, clubId };
  return json({
    user: toSessionUser(newActor),
    pass: db.getPass(actor.memberId),
    memberships: db.listMemberships(actor.memberId),
  } satisfies AuthMeResponse);
});
