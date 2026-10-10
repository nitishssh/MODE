import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { roleSchema } from "../../../../../lib/modules/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin/lead assigns a club role to a member of the same club. */
export const PATCH = route<{ id: string }>("role change", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "roles:manage", mutation: true });
  const { role } = await readJson(request, roleSchema);
  return json({ member: db.setRole(actor, id, role) });
});
