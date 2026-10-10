import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inflow, outflow, balance, committed-but-unpaid reimbursements and per-event breakdown. */
export const GET = route("ledger summary", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "ledger:read" });
  return json({ summary: db.treasury.summary(actor) });
});
