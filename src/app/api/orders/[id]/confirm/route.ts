import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { confirmOrderSchema } from "../../../../../lib/modules/merchandise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer confirms a verified payment; 201 marks paid, 200 replays the same reference. */
export const POST = route<{ id: string }>("order payment", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "payments:confirm", mutation: true });
  const input = await readJson(request, confirmOrderSchema);
  const result = db.merchandise.confirmOrder(actor, id, input);
  return json(result, { status: result.created ? 201 : 200 });
});
