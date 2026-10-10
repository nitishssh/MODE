import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, route } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route<{id:string}>("event report", (request,{id}) => {
  const db=getDatabase(), actor=requireActor(request,db,{permission:"events:report"});
  return json({...db.events.eventReport(actor,id),...db.getEventReport(actor,id)});
});
