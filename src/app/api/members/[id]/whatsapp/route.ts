import { optionalActor, requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { hasPermission } from "../../../../../lib/auth/permissions";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const whatsappSettingsSchema = z
  .object({
    phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/).nullable().optional(),
    optIn: z.boolean().optional(),
  })
  .strict();

export const GET = route("whatsapp settings", (request, { params }) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const { id } = params;

  // Members can only read their own settings; organizers/admins can read any member's
  if (actor.memberId !== id && !hasPermission(actor.role, "members:read")) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const prefs = db.whatsapp.getPreferences(actor.clubId, id);
  return json({
    phone: prefs.phone,
    optIn: prefs.optIn,
    openwaAvailable: process.env.OPENWA_API_URL ? true : false,
  });
});

export const PATCH = route("update whatsapp settings", async (request, { params }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true });
  const { id } = params;

  // Members can only update their own settings
  if (actor.memberId !== id) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const input = await readJson(
    request,
    whatsappSettingsSchema
  );

  const prefs = db.whatsapp.getPreferences(actor.clubId, id);
  const phone = input.phone ?? prefs.phone;
  const optIn = input.optIn ?? prefs.optIn;

  db.whatsapp.setPreferences(actor.clubId, id, phone, optIn);

  return json({
    phone,
    optIn,
    message: "WhatsApp preferences updated",
  });
});
