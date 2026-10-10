import { z } from "zod";
import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, readJson, route } from "../../../lib/http";
import { expenseInputSchema } from "../../../lib/modules/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filterSchema = z.object({ status: z.enum(["submitted", "approved", "rejected", "paid"]).optional() });

/** Own requests for members; every request for reviewers. */
export const GET = route("expense list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const filter = filterSchema.parse({ status: new URL(request.url).searchParams.get("status") ?? undefined });
  return json({ expenses: db.treasury.listExpenses(actor, filter) });
});

/** Volunteer submits an expense with amount, purpose and a receipt (upload or reference). */
export const POST = route("expense submission", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "expenses:submit", mutation: true });
  const input = await readJson(request, expenseInputSchema);
  return json({ expense: db.treasury.submitExpense(actor, input) }, { status: 201 });
});
