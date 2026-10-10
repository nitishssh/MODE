import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({title:z.string().trim().min(1).max(200).optional(),description:z.string().trim().max(2000).nullable().optional(),assigneeId:z.string().min(1).max(100).nullable().optional(),eventId:z.string().min(1).max(100).nullable().optional(),dueAt:z.string().datetime({offset:true}).nullable().optional()}).strict();
export const GET = route<{id:string}>("task lookup", (request,{id}) => {
  const db=getDatabase(); return json(db.getTaskById(requireActor(request,db),id));
});
export const PATCH = route<{id:string}>("task update",async (request,{id}) => {
  const db=getDatabase(),actor=requireActor(request,db,{mutation:true,permission:"tasks:write"});
  return json(db.patchTask(actor,id,await readJson(request,schema)));
});
