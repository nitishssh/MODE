import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { POST as cancelRoute } from "../src/app/api/orders/[id]/cancel/route";
import { POST as confirmRoute } from "../src/app/api/orders/[id]/confirm/route";
import { POST as fulfilRoute } from "../src/app/api/orders/[id]/fulfil/route";
import { GET as mineRoute } from "../src/app/api/orders/mine/route";
import { GET as ordersRoute, POST as orderRoute } from "../src/app/api/orders/route";
import { GET as productsRoute, POST as createProductRoute } from "../src/app/api/products/route";
import { PATCH as variantRoute } from "../src/app/api/products/variants/[id]/route";
import { openClubDatabase } from "../src/lib/database";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { ORDER_HOLD_MS } from "../src/lib/modules/merchandise";
import { DEMO, FIXED_NOW, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

const ACTIVE = "active@example.com";
const EXPIRED = "expired@example.com";
const HOODIE = { name: "Club hoodie", pricePaise: 79900, memberPricePaise: 69900, variants: [{ size: "m", stock: 3 }, { size: "L", stock: 0 }] };

test("products carry per-size stock; orders fix the member discount from membership state, reject zero stock and cap pending units at two", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    assert.throws(() => db.merchandise.createProduct(actorFor(db, DEMO.treasurer), HOODIE), ForbiddenError);
    assert.throws(() => db.merchandise.createProduct(organizer, { ...HOODIE, variants: [{ size: "M", stock: 1 }, { size: "m", stock: 1 }] }), ValidationError);
    const product = db.merchandise.createProduct(organizer, HOODIE);
    assert.deepEqual(product.variants.map((v) => [v.size, v.stock]), [["M", 3], ["L", 0]]);
    assert.equal(product.stock, 3, "aggregate stock is the sum of sizes");
    const [medium, large] = product.variants;

    const starter = db.merchandise.listProducts(organizer.clubId).find((p) => p.id === "demo-product-1")!;
    assert.deepEqual(starter.variants.map((v) => [v.size, v.stock]), [["ONE SIZE", 18]], "starter stock migrated into one size");

    assert.throws(() => db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: large.id }), (e: unknown) => e instanceof ConflictError && e.code === "out_of_stock");
    const member = db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: medium.id, quantity: 2 });
    assert.deepEqual([member.pricing, member.unitPricePaise, member.totalPaise, member.status, member.size], ["member", 69900, 139800, "pending_payment", "M"]);
    assert.equal(member.holdExpiresAt, new Date(FIXED_NOW.getTime() + ORDER_HOLD_MS).toISOString());
    assert.throws(() => db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: medium.id }), (e: unknown) => e instanceof ConflictError && e.code === "pending_limit");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).variants[0].stock, 1);

    const lapsed = db.merchandise.createOrder(actorFor(db, EXPIRED), { variantId: medium.id });
    assert.deepEqual([lapsed.pricing, lapsed.unitPricePaise], ["standard", 79900], "expired membership pays full price");
    assert.throws(() => db.merchandise.createOrder(actorFor(db, EXPIRED), { variantId: medium.id }), (e: unknown) => e instanceof ConflictError && e.code === "out_of_stock");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 0);
    assert.throws(() => db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: "nope" }), NotFoundError);

    // Cancelling frees the pending allowance and the stock.
    assert.equal(db.merchandise.cancelOrder(actorFor(db, ACTIVE), member.id).status, "cancelled");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).variants[0].stock, 2);
    assert.equal(db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: medium.id }).quantity, 1);

    const retired = db.merchandise.setProductActive(organizer, product.id, false);
    assert.equal(retired.active, false);
    assert.throws(() => db.merchandise.createOrder(actorFor(db, EXPIRED), { variantId: medium.id }), (e: unknown) => e instanceof ConflictError && e.code === "product_inactive");
    assert.equal(db.merchandise.listProducts(organizer.clubId).some((p) => p.id === product.id), false);
    assert.equal(db.merchandise.listProducts(organizer.clubId, { includeInactive: true }).some((p) => p.id === product.id), true);
  } finally {
    db.close();
  }
});

test("the last unit cannot be oversold across two connections", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-stock-race-"));
  const path = join(directory, "race.sqlite");
  const a = openClubDatabase(path, { now: () => new Date(FIXED_NOW) });
  const b = openClubDatabase(path, { now: () => new Date(FIXED_NOW) });
  try {
    const organizer = actorFor(a, DEMO.organizer);
    const product = a.merchandise.createProduct(organizer, { name: "Cap", pricePaise: 29900, variants: [{ size: "ONE SIZE", stock: 1 }] });
    const variantId = product.variants[0].id;
    assert.equal(a.merchandise.createOrder(actorFor(a, ACTIVE), { variantId }).status, "pending_payment");
    assert.throws(() => b.merchandise.createOrder(actorFor(b, EXPIRED), { variantId }), (e: unknown) => e instanceof ConflictError && e.code === "out_of_stock");
    assert.equal(b.merchandise.requireProduct(organizer.clubId, product.id).stock, 0);
    assert.equal(a.merchandise.setVariantStock(organizer, variantId, { stock: 1 }).stock, 1);
    assert.equal(b.merchandise.createOrder(actorFor(b, EXPIRED), { variantId }).status, "pending_payment");
  } finally {
    a.close();
    b.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("holds expire after 30 minutes and return stock once; stale and duplicate confirmations post nothing extra; fulfilment follows payment", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const product = db.merchandise.createProduct(organizer, { name: "Tee", pricePaise: 34900, memberPricePaise: 29900, variants: [{ size: "S", stock: 2 }] });
    const variantId = product.variants[0].id;
    const before = db.ledger.balance();

    const stale = db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId, quantity: 2 });
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 0);
    assert.throws(() => db.merchandise.confirmOrder(actorFor(db, DEMO.volunteer), stale.id, { reference: "CASH-1" }), ForbiddenError);
    clock.now = new Date(FIXED_NOW.getTime() + ORDER_HOLD_MS - 1);
    assert.equal(db.merchandise.listOrders(treasurer, "pending_payment").length, 1);
    clock.now = new Date(FIXED_NOW.getTime() + ORDER_HOLD_MS);
    assert.deepEqual(db.merchandise.listOrders(treasurer, "pending_payment"), []);
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 2, "both units returned");
    assert.throws(() => db.merchandise.confirmOrder(treasurer, stale.id, { reference: "CASH-1" }), (e: unknown) => e instanceof ConflictError && e.code === "hold_expired" && e.message === "Hold expired, reorder");
    assert.equal(db.ledger.balance(), before, "no income for an expired hold");
    assert.equal(db.merchandise.myOrders(actorFor(db, ACTIVE))[0].status, "expired");
    assert.throws(() => db.merchandise.cancelOrder(actorFor(db, ACTIVE), stale.id), (e: unknown) => e instanceof ConflictError && e.code === "hold_expired");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 2, "expired hold cannot return stock a second time");

    const fresh = db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId });
    assert.throws(() => db.merchandise.fulfilOrder(organizer, fresh.id), (e: unknown) => e instanceof ConflictError && e.code === "order_not_paid");
    const confirmed = db.merchandise.confirmOrder(treasurer, fresh.id, { reference: "UPI-2" });
    assert.deepEqual([confirmed.created, confirmed.order.status, confirmed.order.confirmedBy, confirmed.order.holdExpiresAt], [true, "paid", treasurer.memberId, null]);
    assert.equal(db.ledger.balance(), before + 29900);
    const entry = db.ledger.list().find((e) => e.sourceType === "merch_order" && e.sourceId === fresh.id)!;
    assert.deepEqual([entry.amountPaise, entry.recordedBy], [29900, treasurer.memberId]);
    const again = db.merchandise.confirmOrder(organizer, fresh.id, { reference: "UPI-3" });
    assert.deepEqual([again.created, again.order.paymentReference], [false, "UPI-2"]);
    assert.equal(db.ledger.list().filter((e) => e.sourceId === fresh.id).length, 1, "one ledger row per paid order");
    assert.throws(() => db.merchandise.cancelOrder(organizer, fresh.id), (e: unknown) => e instanceof ConflictError && e.code === "refunds_out_of_scope");

    assert.throws(() => db.merchandise.fulfilOrder(treasurer, fresh.id), ForbiddenError, "treasurer lacks orders:fulfil");
    const handed = db.merchandise.fulfilOrder(organizer, fresh.id);
    assert.deepEqual([handed.status, handed.fulfilledBy], ["fulfilled", organizer.memberId]);
    assert.equal(db.merchandise.fulfilOrder(organizer, fresh.id).fulfilledAt, handed.fulfilledAt, "repeat fulfilment is a no-op");
    assert.equal(db.merchandise.confirmOrder(organizer, fresh.id, { reference: "UPI-4" }).created, false, "fulfilled orders stay paid");
    assert.equal(db.ledger.balance(), before + 29900);

    // Owner / officer cancellation and repeat cancellation return stock exactly once.
    const other = db.merchandise.createOrder(actorFor(db, EXPIRED), { variantId });
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 0);
    assert.throws(() => db.merchandise.cancelOrder(actorFor(db, DEMO.volunteer), other.id), ForbiddenError);
    assert.equal(db.merchandise.cancelOrder(actorFor(db, EXPIRED), other.id).status, "cancelled");
    assert.equal(db.merchandise.cancelOrder(actorFor(db, EXPIRED), other.id).status, "cancelled");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 1, "returned once, not twice");
    const officerCancel = db.merchandise.createOrder(actorFor(db, EXPIRED), { variantId });
    assert.equal(db.merchandise.cancelOrder(treasurer, officerCancel.id).status, "cancelled");
    assert.throws(() => db.merchandise.listOrders(actorFor(db, DEMO.volunteer)), ForbiddenError);
    assert.throws(() => db.merchandise.releaseExpiredHolds(), /inside a transaction/);

    const free = db.merchandise.createProduct(organizer, { name: "Sticker", pricePaise: 0, variants: [{ size: "ONE SIZE", stock: 5 }] });
    const sticker = db.merchandise.createOrder(actorFor(db, ACTIVE), { variantId: free.variants[0].id });
    assert.deepEqual([sticker.status, sticker.holdExpiresAt], ["paid", null], "free items are paid at order time and post no ledger row");
    assert.equal(db.ledger.balance(), before + 29900);
  } finally {
    db.close();
  }
});

test("merchandise routes: permissions, 201/200 confirmation, cancel, fulfil, stock edits", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const treasurer = await loginCookie(DEMO.treasurer);
    const volunteer = await loginCookie(DEMO.volunteer);
    const active = await loginCookie(ACTIVE);

    assert.equal((await createProductRoute(apiRequest("/api/products", { body: HOODIE, cookie: treasurer }))).status, 403);
    const created = await createProductRoute(apiRequest("/api/products", { body: HOODIE, cookie: organizer }));
    assert.equal(created.status, 201);
    const product = (await created.json()).product;
    const [medium, large] = product.variants;
    const listed = await (await productsRoute(apiRequest("/api/products"))).json();
    assert.ok(listed.products.some((p: { id: string }) => p.id === product.id));

    assert.equal((await variantRoute(apiRequest(`/api/products/variants/${large.id}`, { method: "PATCH", body: { stock: 4 }, cookie: volunteer }), routeParams({ id: large.id }))).status, 403);
    const restocked = await variantRoute(apiRequest(`/api/products/variants/${large.id}`, { method: "PATCH", body: { stock: 4 }, cookie: organizer }), routeParams({ id: large.id }));
    assert.equal(restocked.status, 200);
    assert.equal((await restocked.json()).product.stock, 7);

    assert.equal((await orderRoute(apiRequest("/api/orders", { body: { variantId: medium.id } }))).status, 401);
    assert.equal((await orderRoute(apiRequest("/api/orders", { body: { variantId: medium.id, quantity: 3 }, cookie: active }))).status, 400);
    const ordered = await orderRoute(apiRequest("/api/orders", { body: { variantId: medium.id, quantity: 2 }, cookie: active }));
    assert.equal(ordered.status, 201);
    const order = (await ordered.json()).order;
    assert.deepEqual([order.pricing, order.totalPaise], ["member", 139800]);
    assert.equal((await orderRoute(apiRequest("/api/orders", { body: { variantId: medium.id }, cookie: active }))).status, 409, "pending limit");

    assert.equal((await ordersRoute(apiRequest("/api/orders?status=pending_payment", { cookie: volunteer }))).status, 403);
    const pending = await (await ordersRoute(apiRequest("/api/orders?status=pending_payment", { cookie: treasurer }))).json();
    assert.equal(pending.orders.length, 1);
    assert.equal((await ordersRoute(apiRequest("/api/orders?status=bogus", { cookie: treasurer }))).status, 400);

    const body = { reference: "ROUTE-1" };
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${order.id}/confirm`, { body, cookie: volunteer }), routeParams({ id: order.id }))).status, 403);
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${order.id}/confirm`, { body, cookie: treasurer }), routeParams({ id: order.id }))).status, 201);
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${order.id}/confirm`, { body, cookie: treasurer }), routeParams({ id: order.id }))).status, 200);
    assert.equal((await cancelRoute(apiRequest(`/api/orders/${order.id}/cancel`, { method: "POST", cookie: active }), routeParams({ id: order.id }))).status, 409, "paid orders are not cancellable");
    assert.equal((await fulfilRoute(apiRequest(`/api/orders/${order.id}/fulfil`, { method: "POST", cookie: treasurer }), routeParams({ id: order.id }))).status, 403);
    const fulfilled = await fulfilRoute(apiRequest(`/api/orders/${order.id}/fulfil`, { method: "POST", cookie: organizer }), routeParams({ id: order.id }));
    assert.equal(fulfilled.status, 200);
    assert.equal((await fulfilled.json()).order.status, "fulfilled");

    const second = (await (await orderRoute(apiRequest("/api/orders", { body: { variantId: large.id }, cookie: active }))).json()).order;
    assert.equal((await cancelRoute(apiRequest(`/api/orders/${second.id}/cancel`, { method: "POST", cookie: volunteer }), routeParams({ id: second.id }))).status, 403);
    assert.equal((await cancelRoute(apiRequest(`/api/orders/${second.id}/cancel`, { method: "POST", cookie: active }), routeParams({ id: second.id }))).status, 200);
    const mine = await (await mineRoute(apiRequest("/api/orders/mine", { cookie: active }))).json();
    assert.deepEqual(mine.orders.map((o: { status: string }) => o.status).sort(), ["cancelled", "fulfilled"], "frozen clock: creation order is not observable");
  });
});
