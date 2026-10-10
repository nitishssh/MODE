import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { changePasswordSchema } from "../../../../lib/modules/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Self-service password change: proves the current password, keeps this session, signs out every other one. */
export const POST = route("password change", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const input = await readJson(request, changePasswordSchema);
  return json({ ok: true, ...db.changePassword(actor, input) });
});
