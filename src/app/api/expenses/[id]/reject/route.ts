import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { decisionSchema } from "../../../../../lib/modules/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>("expense rejection", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "expenses:review", mutation: true });
  const hasBody = request.headers.get("content-type")?.includes("application/json") ?? false;
  const { note } = hasBody ? await readJson(request, decisionSchema) : { note: undefined };
  return json({ expense: db.treasury.decide(actor, id, "rejected", note) });
});
