import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, readJson, route } from "../../../lib/http";
import { createMemberSchema } from "../../../lib/member-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Member directory. Emails are personal data, so this needs `members:read`. */
export const GET = route("member list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:read" });
  return json({ members: db.getMembers(actor.clubId) });
});

/** Officers register a member record; the member can later be given credentials or self-register. */
export const POST = route("member creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:create", mutation: true });
  const input = await readJson(request, createMemberSchema);
  const member = db.createMember(input, { clubId: actor.clubId });
  db.recordAudit(actor, "member.created", "member", member.id);
  return json({ member }, { status: 201 });
});
