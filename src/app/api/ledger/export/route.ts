import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const str = /^[\s]*[=+@-]/.test(raw) ? "\'" + raw : raw;
  if (str.includes(",") || str.includes('"') || /[\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function paise(amount: number): string {
  return (amount / 100).toFixed(2);
}

export const GET = route("ledger export", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "ledger:read" });
  try {
    const entries = db.getLedgerEntries(actor);
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
          paise(e.type === "income" ? e.amountPaise : -e.amountPaise),
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
});
