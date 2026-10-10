import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { scanSchema } from "../../../../../lib/modules/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Door scanner. The event is selected by the URL; the body carries a ticket or member token/code. */
export const POST = route<{ id: string }>("door scan", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "tickets:check_in", mutation: true });
  const input = await readJson(request, scanSchema);
  return json(db.events.scan(actor, id, input));
});
