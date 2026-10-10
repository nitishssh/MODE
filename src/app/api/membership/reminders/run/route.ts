import { z } from "zod";
import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ days: z.number().int().min(0).max(365).optional() }).strict();

/** Queue one in-app notification and one simulated outbox row per expiring member. */
export const POST = route("renewal reminders", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "membership:reminders", mutation: true });
  const hasBody = request.headers.get("content-type")?.includes("application/json") ?? false;
  const { days } = hasBody ? await readJson(request, bodySchema) : { days: undefined };
  return json(db.dues.sendRenewalReminders(actor, days));
});
