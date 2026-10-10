import { getDatabase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function paise(amount: number): string {
  return (amount / 100).toFixed(2);
}

export async function GET() {
  try {
    const entries = getDatabase().getLedgerEntries();
    const rows = [
      ["Date", "Type", "Description", "Category", "Event", "Reference", "Amount (₹)"].join(","),
      ...entries.map((e) =>
        [
          escapeCSV(e.occurredAt.slice(0, 10)),
          escapeCSV(e.type === "income" ? "Income" : "Expense (Paid)"),
          escapeCSV(e.description),
          escapeCSV(e.category),
          escapeCSV(e.eventTitle),
          escapeCSV(e.reference),
          escapeCSV(e.type === "income" ? `+${paise(e.amountPaise)}` : `-${paise(e.amountPaise)}`),
        ].join(",")
      ),
    ];
    const csv = rows.join("\r\n");
    const filename = `skyline-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("MODE ledger export failed", error);
    return Response.json({ error: "Unable to export the ledger. Please try again." }, { status: 500 });
  }
}
