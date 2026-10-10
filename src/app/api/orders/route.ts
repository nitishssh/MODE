import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, readJson, route } from "../../../lib/http";
import { orderInputSchema } from "../../../lib/modules/merchandise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Own orders; `?scope=club` lists every order for officers with `orders:fulfil`. */
export const GET = route("order list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const scope = new URL(request.url).searchParams.get("scope");
  return json({ orders: scope === "club" ? db.merchandise.listOrders(actor) : db.merchandise.myOrders(actor) });
});

/** Place an order; the chosen size's stock is reserved atomically. */
export const POST = route("order creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "orders:create", mutation: true });
  const input = await readJson(request, orderInputSchema);
  return json({ order: db.merchandise.createOrder(actor, input) }, { status: 201 });
});
