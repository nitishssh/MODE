import { z } from "zod";
import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { passwordSchema } from "../../../../../lib/modules/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setPasswordSchema = z.object({ password: passwordSchema }).strict();

/** Admin/lead gives an officer-created member a password so they can sign in. */
export const POST = route<{ id: string }>("password set", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "roles:manage", mutation: true });
  const { password } = await readJson(request, setPasswordSchema);
  db.setPassword(actor, id, password);
  return json({ ok: true });
});
