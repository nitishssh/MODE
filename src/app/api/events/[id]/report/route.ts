import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Attendance and income for one event. */
export const GET = route<{ id: string }>("event report", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "events:report" });
  return json({ report: db.events.eventReport(actor, id) });
});
