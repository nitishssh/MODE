import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { payoutSchema } from "../../../../../lib/modules/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Treasurer records the reimbursement payout; this is the only step that changes the cash balance. */
export const POST = route<{ id: string }>("reimbursement payout", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "expenses:review", mutation: true });
  const { paymentReference } = await readJson(request, payoutSchema);
  const result = db.treasury.markPaid(actor, id, paymentReference);
  return json(result, { status: result.created ? 201 : 200 });
});
