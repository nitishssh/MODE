import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST=route<{id:string;action:string}>("expense action",async(request,{id,action})=>{
  const db=getDatabase(),actor=requireActor(request,db,{mutation:true,permission:"expenses:review"});
  if(action==="approve"){await readJson(request,z.object({}).strict());return json(db.approveExpense(actor,id));}
  if(action==="reject"){const input=await readJson(request,z.object({note:z.string().trim().max(500).optional()}).strict());return json(db.rejectExpense(actor,id,input.note));}
  if(action==="pay"){const input=await readJson(request,z.object({paymentReference:z.string().trim().min(1).max(200)}).strict());return json(db.payExpense(actor,id,input.paymentReference));}
  return json({error:"Unknown action."},{status:404});
});
