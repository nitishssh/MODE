import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema=z.object({amountPaise:z.number().int().positive().safe(),purpose:z.string().trim().min(3).max(500),receiptId:z.string().uuid(),receiptReference:z.string().trim().max(200).optional(),eventId:z.string().min(1).max(100).optional()}).strict();
export const GET=route("expenses list",request=>{
  const db=getDatabase(),actor=requireActor(request,db);
  return json(db.getExpenses(actor,{submitterId:new URL(request.url).searchParams.get("submitterId") ?? undefined}));
});
export const POST=route("expense submission",async request=>{
  const db=getDatabase(),actor=requireActor(request,db,{mutation:true,permission:"expenses:submit"});
  return json(db.submitExpense(actor,await readJson(request,schema)),{status:201});
});
