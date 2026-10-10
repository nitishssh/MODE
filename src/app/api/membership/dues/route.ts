import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, readJson, route } from "../../../../lib/http";
import { recordDuesSchema } from "../../../../lib/modules/dues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Officer records dues received; amount comes from club configuration. */
export const POST = route("dues recording", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "membership:record_payment", mutation: true });
  const input = await readJson(request, recordDuesSchema);
  const result = db.dues.recordDues(actor, input);
  return json(result, { status: result.created ? 201 : 200 });
});
