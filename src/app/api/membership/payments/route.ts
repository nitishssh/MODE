import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { recordDuesSchema } from "../../../../lib/modules/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Record dues or a free enrolment. 201 when a membership period was created,
 * 200 when the same payment reference was replayed and nothing was credited again.
 */
export const POST = route("dues recording", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "membership:record_payment", mutation: true });
  const input = await readJson(request, recordDuesSchema);
  const result = db.membership.recordDues(actor, input);
  return json(result, { status: result.created ? 201 : 200 });
});
