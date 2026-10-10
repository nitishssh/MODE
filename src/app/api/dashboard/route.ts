import { getDatabase } from "../../../lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getDatabase().getDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE dashboard read failed", error);
    return Response.json({ error: "Unable to load the dashboard. Please try again." }, { status: 500 });
  }
}
