import { requireActor } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/database";
import { json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>("ledger source", (request, { id }) => {
  const db = getDatabase();
  return json(db.getLedgerSource(requireActor(request, db, { permission: "ledger:read" }), id));
});
