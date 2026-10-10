import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { MAX_RECEIPT_SIZE_BYTES } from "@/lib/contracts";
import { json, route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route("receipt upload", async request => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true, permission: "expenses:submit" });
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return json({ error: "Upload must be sent as multipart/form-data." }, { status: 400 });
  }
  // Bound buffering even for chunked bodies. Reserve 64 KiB for multipart headers.
  const limit = MAX_RECEIPT_SIZE_BYTES + 64 * 1024;
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "A file field named 'file' is required." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let form: FormData;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return json({ error: "Upload is too large. Maximum file size is 5 MB." }, { status: 413 });
      }
      chunks.push(value);
    }
    form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
  } catch {
    return json({ error: "Unable to parse the upload. Please try again." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "A file field named 'file' is required." }, { status: 400 });
  if (file.size > MAX_RECEIPT_SIZE_BYTES) return json({ error: "File is too large. Maximum size is 5 MB." }, { status: 413 });
  const receipt = db.saveReceipt(actor, {
    filename: file.name, mimeType: file.type, sizeBytes: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  });
  return json(receipt, { status: 201 });
});
