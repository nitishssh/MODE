import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("announcement outbox", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "outbox:manage" });
  return json(db.announcements.inspectOutbox(actor, id));
});
