import { hasPermission } from "../../../lib/auth/permissions";
import { optionalActor, requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { DEFAULT_CLUB_ID } from "../../../lib/db/migrations";
import { json, readJson, route } from "../../../lib/http";
import { productInputSchema } from "../../../lib/modules/merchandise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public catalogue with per-size stock. Organizers also see inactive products. */
export const GET = route("product list", (request) => {
  const db = getDatabase();
  const actor = optionalActor(request, db);
  const includeInactive = actor !== null && hasPermission(actor.role, "products:write");
  return json({ products: db.merchandise.listProducts(actor?.clubId ?? DEFAULT_CLUB_ID, { includeInactive }) });
});

export const POST = route("product creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "products:write", mutation: true });
  const input = await readJson(request, productInputSchema);
  return json({ product: db.merchandise.createProduct(actor, input) }, { status: 201 });
});
