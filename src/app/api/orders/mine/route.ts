import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("my orders", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json({ orders: db.merchandise.myOrders(actor) });
});
