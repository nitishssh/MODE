import { z } from "zod";
import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filterSchema = z.object({
  category: z.enum(["membership", "ticket", "merchandise", "reimbursement", "other"]).optional(),
  eventId: z.string().min(1).optional(),
});

export const GET = route("ledger entries", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "ledger:read" });
  const url = new URL(request.url);
  const filter = filterSchema.parse({
    category: url.searchParams.get("category") ?? undefined,
    eventId: url.searchParams.get("eventId") ?? undefined,
  });
  return json({ entries: db.treasury.listEntries(actor, filter) });
});
