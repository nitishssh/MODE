import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { reminderRunSchema } from "../../../../../lib/modules/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Queue renewal reminders into the outbox for memberships ending within `daysAhead`. */
export const POST = route("renewal reminders", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "membership:reminders", mutation: true });
  const hasBody = request.headers.get("content-type")?.includes("application/json") ?? false;
  const input = hasBody ? await readJson(request, reminderRunSchema) : {};
  return json(db.membership.runRenewalReminders(actor, input));
});
