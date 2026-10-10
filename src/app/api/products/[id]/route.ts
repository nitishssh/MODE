import { z } from "zod";
import { optionalActor, requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../../lib/db/migrations";
import { json, readJson, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeSchema = z.object({ active: z.boolean() }).strict();

export const GET = route<{ id: string }>("product detail", (request, { id }) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  return json({ product: db.merchandise.requireProduct(actor?.clubId ?? DEFAULT_CLUB_ID, id) });
});

/** Retire or re-activate a product. Stock per size is set on the variant route. */
export const PATCH = route<{ id: string }>("product update", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "products:write", mutation: true });
  const { active } = await readJson(request, activeSchema);
  return json({ product: db.merchandise.setProductActive(actor, id, active) });
});
