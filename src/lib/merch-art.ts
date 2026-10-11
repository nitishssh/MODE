/**
 * Product photographs for the merchandise line. Art lives in public/merch/ as
 * one square SVG per product, named by the slug of the product name, and is
 * regenerated with `node scripts/merch-art.mjs`. Products without their own
 * art get the club default so the line never shows a broken frame.
 */

const KNOWN = new Set([
  "mode-club-hoodie", "sample-club-hoodie", "hoodie",
  "rhythm-2026-fest-tee", "sample-club-t-shirt", "trek-dry-fit-tee",
  "varsity-jacket", "hackathon-cap", "insulated-steel-bottle", "canvas-tote-bag",
  "enamel-pin-set", "notebook-and-pen-kit", "laptop-sticker-pack",
]);

export function merchSlug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** URL of the product's art, or the default when none has been drawn yet. */
export function merchImage(name: string): string {
  const slug = merchSlug(name);
  return `/merch/${KNOWN.has(slug) ? slug : "default"}.svg`;
}
