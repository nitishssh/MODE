import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Attempt delivery of queued messages. With the local preview transport the
 * result is `previewed`; the response says so explicitly and never claims `sent`.
 */
export const POST = route("outbox dispatch", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "outbox:manage", mutation: true });
  return json(await db.outbox.dispatch(actor));
});
