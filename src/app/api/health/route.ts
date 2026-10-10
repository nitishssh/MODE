import { getDatabase } from "../../../lib/database";
import { json } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(getDatabase().health());
  } catch (error) {
    console.error("MODE database health check failed", error);
    return json({ status: "error", error: "Database is unavailable." }, { status: 503 });
  }
}
