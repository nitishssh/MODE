import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner cancels their own pending order; officers with payments:confirm cancel any pending hold. */
export const POST = route<{ id: string }>("order cancellation", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  return json({ order: db.merchandise.cancelOrder(actor, id) });
});
