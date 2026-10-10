import { getDatabase } from "../../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getDatabase().health(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE database health check failed", error);
    return Response.json({ status: "error", error: "Database is unavailable." }, { status: 503 });
  }
}
