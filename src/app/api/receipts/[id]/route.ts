import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET=route<{id:string}>("receipt download",(request,{id})=>{
  const db=getDatabase(),actor=requireActor(request,db);
  const receipt=db.getReceiptById(actor,id),file=db.getReceiptFile(actor,id);
  if(!file)return json({error:"Receipt file not found."},{status:404});
  return new Response(new Uint8Array(file),{headers:{"Content-Type":receipt.mimeType,"Content-Disposition":`inline; filename="${receipt.filename}"`,"Content-Length":String(file.length),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
});
