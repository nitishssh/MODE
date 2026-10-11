import { requireActor } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/database";
import { json, route } from "@/lib/http";
import { applyRateLimitHeaders, enforceWorkspaceRateLimit } from "@/lib/traffic-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Compact counts for persistent app chrome; never returns whole collections. */
export const GET = route("workspace summary", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const limit = enforceWorkspaceRateLimit(actor, "summary");
  return applyRateLimitHeaders(json(db.getWorkspaceChrome(actor)), limit);
});
