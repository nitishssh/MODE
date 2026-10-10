import { getDatabase } from "@/lib/database";
import { requireActor } from "@/lib/auth/authorize";
import { route } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// MIME type magic-byte signatures for server-side validation (never trust browser MIME)
const MAGIC_SIGNATURES: [Uint8Array, string][] = [
  [new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"],
  [new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png"],
  [new Uint8Array([0x52, 0x49, 0x46, 0x46]), "image/webp"], // RIFF....WEBP
  [new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf"], // %PDF
];

function detectMimeType(bytes: Uint8Array): string | null {
  for (const [sig, mime] of MAGIC_SIGNATURES) {
    if (bytes.length >= sig.length) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (bytes[i] !== sig[i]) { match = false; break; }
      }
      if (match) {
        // Extra WebP check: bytes 8-11 must be "WEBP"
        if (mime === "image/webp") {
          const webp = new Uint8Array([0x57, 0x45, 0x42, 0x50]);
          if (bytes.length < 12) return null;
          let webpMatch = true;
          for (let i = 0; i < 4; i++) {
            if (bytes[8 + i] !== webp[i]) { webpMatch = false; break; }
          }
          if (!webpMatch) continue;
        }
        return mime;
      }
    }
  }
  return null;
}

export const POST = route("receipt upload", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { mutation: true, permission: "expenses:submit" });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Upload must be sent as multipart/form-data." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Unable to parse the upload. Please try again." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "A file field named 'file' is required." }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "File is too large. Maximum size is 2 MB." }, { status: 413 });
  }
  if (file.size === 0) {
    return Response.json({ error: "File must not be empty." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detectedMime = detectMimeType(bytes);

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    return Response.json(
      { error: "Unsupported file type. Please upload a JPEG, PNG, WebP, or PDF file." },
      { status: 415 },
    );
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);

  try {
    const receipt = db.saveReceipt(actor, {
      filename: safeFilename,
      mimeType: detectedMime,
      sizeBytes: file.size,
      data: Buffer.from(arrayBuffer),
    });
    return Response.json(receipt, { status: 201 });
  } catch (error) {
    console.error("MODE receipt upload failed", error);
    return Response.json({ error: "Unable to save the receipt. Please try again." }, { status: 500 });
  }
});
