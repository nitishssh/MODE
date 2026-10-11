import { requireActor } from "../../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../../lib/database";
import { json, route } from "../../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>("retry WhatsApp delivery", (request, { id }) => {
  const db = getDatabase();
  return json(db.whatsapp.retry(requireActor(request, db, { permission: "outbox:manage", mutation: true }), id));
});
