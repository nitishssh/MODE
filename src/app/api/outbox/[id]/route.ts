import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { NotFoundError } from "../../../../lib/errors";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preview one queued message, clearly labelled with the transport in use. */
export const GET = route<{ id: string }>("outbox preview", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "outbox:manage" });
  const message = db.outbox.preview(actor, id);
  if (!message) throw new NotFoundError("Outbox message not found.");
  return json({ message });
});
