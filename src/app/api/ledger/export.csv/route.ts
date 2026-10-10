import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(value: string | null): string {
  const raw = value ?? "";
  const safe = /^[\t\r\n]|^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
  return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

export const GET = route("ledger CSV export", request => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "ledger:read" });
  const entries = db.getLedgerEntries(actor);
  const rows = ["date,kind,amount,source_type,source_id,description,recorded_by"];
  for (const entry of entries) {
    // Positive numeric rupees; direction is carried by kind.
    const amount = BigInt(entry.amountPaise);
    rows.push([
      cell(entry.occurredAt.slice(0, 10)), entry.kind,
      `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`,
      cell(entry.sourceType), cell(entry.sourceId), cell(entry.description), cell(entry.recordedByName),
    ].join(","));
  }
  return new Response(rows.join("\r\n"), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="mode-ledger.csv"',
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
});
