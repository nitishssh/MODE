import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = getDatabase().getLedgerEntries();
    return Response.json(entries, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("MODE ledger entries failed", error);
    return Response.json({ error: "Unable to load ledger entries. Please try again." }, { status: 500 });
  }
}
