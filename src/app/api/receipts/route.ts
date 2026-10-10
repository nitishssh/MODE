import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { DomainError, ValidationError } from "../../../lib/errors";
import { json, route } from "../../../lib/http";
import { RECEIPT_MAX_BYTES } from "../../../lib/modules/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload a receipt as `multipart/form-data` with a single `file` field.
 * Size and type are checked before the bytes are read into the store.
 */
export const POST = route("receipt upload", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "expenses:submit", mutation: true });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > RECEIPT_MAX_BYTES + 4096) throw new DomainError("Receipts must be at most 2 MB.", 413, "receipt_too_large");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ValidationError("Send the receipt as multipart/form-data with a `file` field.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError("Missing `file` field.", [{ field: "file", message: "Required." }]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const receipt = db.treasury.storeReceipt(actor, { name: file.name, type: file.type, bytes });
  return json({ receipt }, { status: 201 });
});
