import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hand-over of a paid order. */
export const POST = route<{ id: string }>("order fulfilment", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "orders:fulfil", mutation: true });
  return json({ order: db.merchandise.fulfilOrder(actor, id) });
});
