import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as confirmRoute } from "../src/app/api/orders/[id]/confirm/route";
import { GET as listOrdersRoute, POST as orderRoute } from "../src/app/api/orders/route";
import { GET as productsRoute } from "../src/app/api/products/route";
import { PLAN_ANNUAL_ID } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import type { Actor } from "../src/lib/modules/identity";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

type Db = ReturnType<typeof memoryDatabase>["db"];
const HOODIE = "demo-product-1";

function memberActor(db: Db, email: string): Actor {
  db.createMemberWithCredentials({ name: `Member ${email}`, email, password: "member-pass-123", role: "member" });
  return actorFor(db, email, "member-pass-123");
}

const sizeStock = (db: Db, clubId: string, size: string) => db.merchandise.requireProduct(clubId, HOODIE).variants.find((v) => v.size === size)!.stock;

test("orders decrement only the chosen size, reject out-of-stock sizes and keep the aggregate in sync", () => {
  const { db } = memoryDatabase();
  try {
    const buyer = memberActor(db, "buyer@example.com");
    const clubId = buyer.clubId;
    const hoodie = db.merchandise.requireProduct(clubId, HOODIE);
    assert.equal(hoodie.stock, 18, "starter aggregate preserved");
    const xl = hoodie.variants.find((v) => v.size === "XL")!;
    assert.equal(xl.stock, 3);

    assert.throws(() => db.merchandise.createOrder(buyer, { variantId: xl.id, quantity: 4 }), (error: unknown) => error instanceof ConflictError && error.code === "out_of_stock");
    const order = db.merchandise.createOrder(buyer, { variantId: xl.id, quantity: 3 });
    assert.deepEqual([order.status, order.pricing, order.unitPricePaise, order.totalPaise], ["pending_payment", "guest", 79900, 239700]);
    assert.equal(sizeStock(db, clubId, "XL"), 0);
    assert.equal(sizeStock(db, clubId, "L"), 5, "other sizes untouched");
    assert.equal(db.merchandise.requireProduct(clubId, HOODIE).stock, 15);
    assert.throws(() => db.merchandise.createOrder(memberActor(db, "late@example.com"), { variantId: xl.id, quantity: 1 }), ConflictError);
    assert.throws(() => db.merchandise.createOrder(buyer, { variantId: "missing", quantity: 1 }), NotFoundError);

    const cancelled = db.merchandise.cancelOrder(buyer, order.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(sizeStock(db, clubId, "XL"), 3, "cancellation restores stock");
    assert.equal(db.merchandise.cancelOrder(buyer, order.id).status, "cancelled", "cancel is idempotent");
    assert.equal(sizeStock(db, clubId, "XL"), 3, "second cancel does not restock twice");
  } finally {
    db.close();
  }
});

test("members with active paid membership get the member price; others pay the regular price", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const paid = memberActor(db, "paidbuyer@example.com");
    db.membership.recordDues(organizer, { memberId: paid.memberId, planId: PLAN_ANNUAL_ID, paymentReference: "M-1", amountPaise: 50000 });
    const medium = db.merchandise.requireProduct(paid.clubId, HOODIE).variants.find((v) => v.size === "M")!;
    const memberOrder = db.merchandise.createOrder(paid, { variantId: medium.id, quantity: 2 });
    assert.deepEqual([memberOrder.pricing, memberOrder.unitPricePaise, memberOrder.totalPaise], ["member", 69900, 139800]);

    clock.now = new Date("2027-12-01T08:00:00.000Z");
    const expiredOrder = db.merchandise.createOrder(paid, { variantId: medium.id, quantity: 1 });
    assert.deepEqual([expiredOrder.pricing, expiredOrder.unitPricePaise], ["guest", 79900]);
  } finally {
    db.close();
  }
});

test("payment confirmation is idempotent, posts one ledger row and gates fulfilment", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const buyer = memberActor(db, "payer@example.com");
    const small = db.merchandise.requireProduct(buyer.clubId, HOODIE).variants.find((v) => v.size === "S")!;
    const order = db.merchandise.createOrder(buyer, { variantId: small.id, quantity: 1 });
    const before = db.getDashboard(treasurer).metrics.balancePaise;

    assert.throws(() => db.merchandise.fulfilOrder(organizer, order.id), (error: unknown) => error instanceof ConflictError && error.code === "order_not_paid");
    assert.throws(() => db.merchandise.confirmOrder(buyer, order.id, { paymentReference: "O-1", amountPaise: 79900 }), ForbiddenError);
    assert.throws(() => db.merchandise.confirmOrder(treasurer, order.id, { paymentReference: "O-1", amountPaise: 1 }), ValidationError);

    const paid = db.merchandise.confirmOrder(treasurer, order.id, { paymentReference: "O-1", amountPaise: 79900 });
    assert.equal(paid.created, true);
    assert.equal(paid.order.status, "paid");
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 79900);
    const replay = db.merchandise.confirmOrder(treasurer, order.id, { paymentReference: "O-1", amountPaise: 79900 });
    assert.equal(replay.created, false);
    assert.equal(db.getDashboard(treasurer).metrics.balancePaise, before + 79900, "duplicate confirmation credits nothing");
    assert.throws(() => db.merchandise.confirmOrder(treasurer, order.id, { paymentReference: "O-2", amountPaise: 79900 }), (error: unknown) => error instanceof ConflictError && error.code === "already_paid");

    const other = db.merchandise.createOrder(memberActor(db, "other@example.com"), { variantId: small.id, quantity: 1 });
    assert.throws(() => db.merchandise.confirmOrder(treasurer, other.id, { paymentReference: "O-1", amountPaise: 79900 }), (error: unknown) => error instanceof ConflictError && error.code === "payment_reference_reused");

    assert.throws(() => db.merchandise.cancelOrder(buyer, order.id), ForbiddenError, "members cannot cancel a paid order themselves");
    const fulfilled = db.merchandise.fulfilOrder(organizer, order.id);
    assert.equal(fulfilled.fulfilment, "fulfilled");
    assert.throws(() => db.merchandise.cancelOrder(organizer, order.id), (error: unknown) => error instanceof ConflictError && error.code === "order_fulfilled");
    assert.equal(db.merchandise.listOrders(organizer).length, 2);
    assert.throws(() => db.merchandise.listOrders(buyer), ForbiddenError);
    assert.equal(db.merchandise.myOrders(buyer).length, 1);
  } finally {
    db.close();
  }
});

test("officers can cancel a paid unfulfilled order and stock returns; product creation validates sizes", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const buyer = memberActor(db, "refund@example.com");
    const product = db.merchandise.createProduct(organizer, { name: "Cap", description: "", pricePaise: 19900, memberPricePaise: null, variants: [{ size: "one size", stock: 1 }] });
    assert.equal(product.variants[0].size, "ONE SIZE");
    assert.throws(() => db.merchandise.createProduct(organizer, { name: "Dup", description: "", pricePaise: 1, memberPricePaise: null, variants: [{ size: "m", stock: 1 }, { size: "M", stock: 1 }] }), ValidationError);
    assert.throws(() => db.merchandise.createProduct(buyer, { name: "Nope", description: "", pricePaise: 1, memberPricePaise: null, variants: [{ size: "M", stock: 1 }] }), ForbiddenError);

    const order = db.merchandise.createOrder(buyer, { variantId: product.variants[0].id, quantity: 1 });
    assert.equal(order.pricing, "guest", "no member price configured");
    db.merchandise.confirmOrder(organizer, order.id, { paymentReference: "CAP-1", amountPaise: 19900 });
    const cancelled = db.merchandise.cancelOrder(organizer, order.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(db.merchandise.requireProduct(organizer.clubId, product.id).stock, 1);
    const restocked = db.merchandise.setVariantStock(organizer, product.variants[0].id, 10);
    assert.equal(restocked.stock, 10);
  } finally {
    db.close();
  }
});

test("concurrent orders for the last unit never oversell through the route", async () => {
  await withRouteDatabase(async () => {
    const catalogue = await (await productsRoute(apiRequest("/api/products"))).json();
    const xl = catalogue.products.find((p: { id: string }) => p.id === HOODIE).variants.find((v: { size: string }) => v.size === "XL");
    assert.equal(xl.stock, 3);

    const { POST: register } = await import("../src/app/api/auth/register/route");
    const cookies: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await register(apiRequest("/api/auth/register", { body: { name: `Shopper ${i}`, email: `shopper${i}@example.com`, password: "shopper-pass-123" } }));
      cookies.push(`mode_session=${/mode_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")![1]}`);
    }
    const results = await Promise.all(cookies.map((cookie) => orderRoute(apiRequest("/api/orders", { body: { variantId: xl.id, quantity: 1 }, cookie }))));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 201, 201, 409, 409]);
    assert.equal((await orderRoute(apiRequest("/api/orders", { body: { variantId: xl.id, quantity: 1 } }))).status, 401);

    const after = await (await productsRoute(apiRequest("/api/products"))).json();
    assert.equal(after.products.find((p: { id: string }) => p.id === HOODIE).variants.find((v: { size: string }) => v.size === "XL").stock, 0);

    const orderId = (await results[0].json()).order.id;
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${orderId}/confirm`, { body: { paymentReference: "R-1", amountPaise: 79900 }, cookie: cookies[0] }), routeParams({ id: orderId }))).status, 403);
    const treasurer = await loginCookie(DEMO.treasurer);
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${orderId}/confirm`, { body: { paymentReference: "R-1", amountPaise: 79900 }, cookie: treasurer }), routeParams({ id: orderId }))).status, 201);
    assert.equal((await confirmRoute(apiRequest(`/api/orders/${orderId}/confirm`, { body: { paymentReference: "R-1", amountPaise: 79900 }, cookie: treasurer }), routeParams({ id: orderId }))).status, 200);
    assert.equal((await listOrdersRoute(apiRequest("/api/orders?scope=club", { cookie: cookies[0] }))).status, 403);
    assert.equal((await (await listOrdersRoute(apiRequest("/api/orders", { cookie: cookies[0] }))).json()).orders.length, 1);
  });
});
