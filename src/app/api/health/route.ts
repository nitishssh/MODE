import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("health", () => {
  try {
    return json(getDatabase().health());
  } catch {
    return json({ status: "error", error: "Database is unavailable." }, { status: 503 });
  }
});
