import { requireActor } from "../../../../../lib/auth/authorize";
import { getDatabase } from "../../../../../lib/database";
import { json, readJson, route } from "../../../../../lib/http";
import { variantStockSchema } from "../../../../../lib/modules/merchandise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set the available stock of one size. */
export const PATCH = route<{ id: string }>("variant stock", async (request, { id }) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "products:write", mutation: true });
  const input = await readJson(request, variantStockSchema);
  return json({ product: db.merchandise.setVariantStock(actor, id, input) });
});
