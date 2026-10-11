import { requireActor } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/database";
import { json, route } from "@/lib/http";
import { readPageQuery } from "@/lib/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("v2 task list", request => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  return json(db.getTasksPage(actor, readPageQuery(request)));
});
