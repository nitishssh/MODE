import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { whatsappGroupSchema } from "../../../../lib/modules/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route("WhatsApp group", (request) => {
  const db = getDatabase();
  return json({ group: db.whatsapp.group(requireActor(request, db, { permission: "outbox:manage" })), senderReady: false });
});
export const PUT = route("update WhatsApp group", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "outbox:manage", mutation: true });
  return json({ group: db.whatsapp.saveGroup(actor, await readJson(request, whatsappGroupSchema)), senderReady: false });
});
