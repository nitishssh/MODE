import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route<{id:string}>("task status",async (request,{id}) => {
  const db=getDatabase(),actor=requireActor(request,db,{mutation:true});
  const input=await readJson(request,z.object({status:z.enum(["todo","in_progress","done"])}).strict());
  return json(db.updateTaskStatus(actor,id,input.status));
});
