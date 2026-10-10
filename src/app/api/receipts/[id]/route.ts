import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { route } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stream a receipt to its uploader or a reviewer. Served inline-safe: no sniffing, no caching. */
export const GET = route<{ id: string }>("receipt download", (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const { receipt, bytes } = db.treasury.readReceipt(actor, id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${receipt.originalName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
