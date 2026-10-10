import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { confirmOrderSchema } from "../../../../../lib/modules/merchandise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer confirms payment: 201 when the order moves to paid, 200 when it already was. */
export const POST = route<{ id: string }>("order confirmation", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "payments:confirm", mutation: true });
  const input = await readJson(request, confirmOrderSchema);
  const result = db.merchandise.confirmOrder(actor, id, input);
  return json(result, { status: result.created ? 201 : 200 });
});
