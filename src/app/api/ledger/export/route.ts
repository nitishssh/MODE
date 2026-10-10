import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV download of every ledger row for the treasurer's reconciliation. */
export const GET = route("ledger export", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "ledger:read" });
  return new Response(db.treasury.exportCsv(actor), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mode-ledger.csv"',
      "Cache-Control": "no-store",
    },
  });
});
