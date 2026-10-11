import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route("WhatsApp delivery queue", (request) => {
  const db = getDatabase();
  return json({ deliveries: db.whatsapp.list(requireActor(request, db, { permission: "outbox:manage" })), senderReady: false });
});
