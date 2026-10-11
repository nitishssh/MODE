import { requireActor } from "@/lib/auth/authorize";
import { getDatabase } from "@/lib/database";
import { json, route } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { applyRateLimitHeaders, enforceWorkspaceRateLimit } from "@/lib/traffic-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** On-demand bounded search; results are scoped to the current club and permissions. */
export const GET = route("workspace search", (request) => {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) throw new ValidationError("Search must contain 2 to 100 characters.");
  const db = getDatabase();
  const actor = requireActor(request, db);
  const limit = enforceWorkspaceRateLimit(actor, "search");
  return applyRateLimitHeaders(json({ results: db.searchWorkspace(actor, query, 6) }), limit);
}, { admission: "shed-first" });
