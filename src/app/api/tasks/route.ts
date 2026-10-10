import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { json, readJson, route } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().max(2000).optional(),assigneeId:z.string().min(1).max(100).optional(),eventId:z.string().min(1).max(100).optional(),dueAt:z.string().datetime({offset:true}).optional()}).strict();
export const GET = route("tasks list", request => {
  const db = getDatabase(), actor = requireActor(request,db);
  const q = new URL(request.url).searchParams;
  return json(db.getTasks(actor,{status:q.get("status") ?? undefined,assigneeId:q.get("assigneeId") ?? undefined,eventId:q.get("eventId") ?? undefined,overdue:q.get("overdue") === "true",mine:q.get("mine") === "true"}));
});
export const POST = route("task creation", async request => {
  const db = getDatabase(), actor = requireActor(request,db,{mutation:true,permission:"tasks:write"});
  return json(db.createTask(actor,await readJson(request,schema)),{status:201});
});
