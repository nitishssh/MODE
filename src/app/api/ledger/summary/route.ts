import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = getDatabase().getLedgerSummary();
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE ledger summary failed", error);
    return Response.json({ error: "Unable to load the financial summary. Please try again." }, { status: 500 });
  }
}
