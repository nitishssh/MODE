import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, route } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET=route("ledger entries",request=>{const db=getDatabase();return json(db.getLedgerEntries(requireActor(request,db,{permission:"ledger:read"})));});
