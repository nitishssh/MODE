import { getDatabase, NotFoundError } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDatabase();
    const receipt = db.getReceiptById(id);
    const file = db.getReceiptFile(id);
    if (!file) {
      // Return metadata only if file not accessible (e.g. :memory: mode)
      return Response.json(receipt, { headers: { "Cache-Control": "no-store" } });
    }
    return new Response(new Blob([new Uint8Array(file)]), {
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Disposition": `inline; filename="${receipt.filename}"`,
        "Content-Length": String(receipt.sizeBytes),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Receipt not found." }, { status: 404 });
    }
    console.error("MODE receipt fetch failed", error);
    return Response.json({ error: "Unable to load the receipt. Please try again." }, { status: 500 });
  }
}
