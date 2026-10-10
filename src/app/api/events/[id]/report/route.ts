import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET=route<{id:string}>("event report",(request,{id})=>{const db=getDatabase();return json(db.getEventReport(requireActor(request,db,{permission:"events:report"}),id));});
