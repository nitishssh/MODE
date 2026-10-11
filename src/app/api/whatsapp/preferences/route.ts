import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { whatsappPreferenceSchema } from "../../../../lib/modules/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route("WhatsApp preferences", (request) => {
  const db = getDatabase();
  return json({ preferences: db.whatsapp.preferences(requireActor(request, db)), senderReady: false });
});
export const PUT = route("update WhatsApp preferences", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  return json({ preferences: db.whatsapp.savePreferences(actor, await readJson(request, whatsappPreferenceSchema)), senderReady: false });
});
