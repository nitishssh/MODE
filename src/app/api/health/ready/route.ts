import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness of the selected SQLite or PostgreSQL database and its schema. */
export const GET = route("readiness", () => {
  try {
    const health = getDatabase().health();
    return json({ ...health, checks: { database: "ok" } });
  } catch {
    return json(
      { status: "error", checks: { database: "unavailable" } },
      { status: 503 },
    );
  }
});
