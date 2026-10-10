import { z } from "zod";
import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, readJson, route } from "../../../lib/http";
import { createOrderSchema } from "../../../lib/modules/merchandise";
import { parseInput } from "../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ status: z.enum(["pending_payment", "paid", "fulfilled", "cancelled", "expired"]).optional() }).strict();

/** Officer list of orders; `?status=pending_payment` is the confirmation desk, `?status=paid` the hand-over list. */
export const GET = route("order list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db);
  const { status } = parseInput(querySchema, { status: new URL(request.url).searchParams.get("status") ?? undefined });
  return json({ orders: db.merchandise.listOrders(actor, status) });
});

/** Signed-in member orders one size; stock is reserved for 30 minutes. */
export const POST = route("order creation", async (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "orders:create", mutation: true });
  const input = await readJson(request, createOrderSchema);
  return json({ order: db.merchandise.createOrder(actor, input) }, { status: 201 });
});
