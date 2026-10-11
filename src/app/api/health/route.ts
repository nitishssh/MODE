import { getDatabase } from "../../../lib/database";
import { CapacityError } from "../../../lib/errors";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("health", () => {
  try {
    return json(getDatabase().health());
  } catch (error) {
    throw new CapacityError("Database is unavailable.", "database", 1, error);
  }
}, { admission: "bypass" });
