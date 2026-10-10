import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasPermission } from "../auth/permissions";
import type { MerchOrder, ProductDetails, ProductVariant } from "../contracts";
import { clubDate, int, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { SOURCE_RESOLVERS, postLedgerEntry } from "./ledger";
import { membershipState } from "./membership-state";

/** A pending order holds its units for this long; then releaseExpiredHolds() returns them. */
export const ORDER_HOLD_MINUTES = 30;
export const ORDER_HOLD_MS = ORDER_HOLD_MINUTES * 60_000;
/** A member may hold at most this many unpaid units of one size at a time. */
export const MAX_PENDING_UNITS_PER_VARIANT = 2;
/** …and at most this many unpaid units across every size and product (audit #21). */
export const MAX_PENDING_UNITS_PER_MEMBER = 6;

const variantSchema = z.object({ size: z.string().trim().min(1).max(20), stock: z.number().int().min(0).max(100_000) }).strict();
export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).default(""),
    pricePaise: z.number().int().min(0),
    memberPricePaise: z.number().int().min(0).nullable().default(null),
    variants: z.array(variantSchema).min(1).max(20),
  })
  .strict();
export const variantStockSchema = z.object({ stock: z.number().int().min(0).max(100_000) }).strict();
export const createOrderSchema = z
  .object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(MAX_PENDING_UNITS_PER_VARIANT).default(1) })
  .strict();
export const confirmOrderSchema = z.object({ reference: z.string().trim().min(3).max(120) }).strict();

SOURCE_RESOLVERS.merch_order = (db, sourceId) =>
  db.prepare("SELECT 1 FROM merch_orders WHERE id = ? AND status IN ('paid', 'fulfilled')").get(sourceId) !== undefined;

const ORDER_SELECT = `SELECT o.*, p.name AS product_name, v.size, m.name AS member_name
  FROM merch_orders o JOIN products p ON p.id = o.product_id JOIN product_variants v ON v.id = o.variant_id JOIN members m ON m.id = o.member_id`;

function mapOrder(row: Row): MerchOrder {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    memberName: text(row.member_name),
    productId: text(row.product_id),
    productName: text(row.product_name),
    variantId: text(row.variant_id),
    size: text(row.size),
    quantity: int(row.quantity),
    unitPricePaise: int(row.unit_price_paise),
    totalPaise: int(row.total_paise),
    pricing: row.pricing as MerchOrder["pricing"],
    status: row.status as MerchOrder["status"],
    holdExpiresAt: nullableText(row.hold_expires_at),
    paidAt: nullableText(row.paid_at),
    paymentReference: nullableText(row.payment_reference),
    confirmedBy: nullableText(row.confirmed_by),
    fulfilledAt: nullableText(row.fulfilled_at),
    fulfilledBy: nullableText(row.fulfilled_by),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** Merchandise (P3, #6): size variants with their own stock, member orders with 30-minute holds, one ledger row per paid order. */
export function createMerchandiseModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;

  // ----- products -----------------------------------------------------------

  function variantsFor(productId: string): ProductVariant[] {
    return (db.prepare("SELECT id, size, stock FROM product_variants WHERE product_id = ? ORDER BY rowid").all(productId) as Row[]).map((row) => ({
      id: text(row.id),
      size: text(row.size),
      stock: int(row.stock),
    }));
  }

  function mapProduct(row: Row): ProductDetails {
    return {
      id: text(row.id),
      name: text(row.name),
      pricePaise: int(row.price_paise),
      stock: int(row.stock),
      description: text(row.description),
      memberPricePaise: row.member_price_paise === null ? null : int(row.member_price_paise),
      active: int(row.active) === 1,
      variants: variantsFor(text(row.id)),
    };
  }

  function listProducts(clubId: string, options: { includeInactive?: boolean } = {}): ProductDetails[] {
    const sql = options.includeInactive
      ? "SELECT * FROM products WHERE club_id = ? ORDER BY name, id"
      : "SELECT * FROM products WHERE club_id = ? AND active = 1 ORDER BY name, id";
    return (db.prepare(sql).all(clubId) as Row[]).map(mapProduct);
  }

  function requireProduct(clubId: string, productId: string): ProductDetails {
    const row = db.prepare("SELECT * FROM products WHERE club_id = ? AND id = ?").get(clubId, productId) as Row | undefined;
    if (!row) throw new NotFoundError("Product not found.");
    return mapProduct(row);
  }

  /** The starter's aggregate `products.stock` stays equal to the sum of its sizes for the dashboard. */
  function syncAggregateStock(productId: string): void {
    db.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = ?) WHERE id = ?").run(productId, productId);
  }

  function createProduct(actor: Actor, input: z.input<typeof createProductSchema>): ProductDetails {
    assertPermission(actor, "products:write");
    const data = parseInput(createProductSchema, input);
    const sizes = data.variants.map((v) => v.size.toUpperCase());
    if (new Set(sizes).size !== sizes.length) throw new ValidationError("Each size may appear only once.", [{ field: "variants", message: "Duplicate size." }]);
    return transaction(ctx, () => {
      const id = randomUUID();
      db.prepare("INSERT INTO products (id, name, price_paise, stock, club_id, description, member_price_paise, active) VALUES (?, ?, ?, 0, ?, ?, ?, 1)").run(
        id, data.name, data.pricePaise, actor.clubId, data.description, data.memberPricePaise,
      );
      const insert = db.prepare("INSERT INTO product_variants (id, club_id, product_id, size, stock) VALUES (?, ?, ?, ?, ?)");
      data.variants.forEach((variant, index) => insert.run(randomUUID(), actor.clubId, id, sizes[index], variant.stock));
      syncAggregateStock(id);
      identity.recordAudit(actor, "product.created", "product", id, { name: data.name, sizes });
      return requireProduct(actor.clubId, id);
    });
  }

  /** Officer sets the available (unheld) stock of one size. */
  function setVariantStock(actor: Actor, variantId: string, input: z.input<typeof variantStockSchema>): ProductDetails {
    assertPermission(actor, "products:write");
    const { stock } = parseInput(variantStockSchema, input);
    return transaction(ctx, () => {
      releaseExpiredHolds();
      const variant = db.prepare("SELECT product_id FROM product_variants WHERE club_id = ? AND id = ?").get(actor.clubId, variantId) as Row | undefined;
      if (!variant) throw new NotFoundError("Product size not found.");
      db.prepare("UPDATE product_variants SET stock = ? WHERE id = ?").run(stock, variantId);
      syncAggregateStock(text(variant.product_id));
      identity.recordAudit(actor, "variant.stock_set", "product_variant", variantId, { stock });
      return requireProduct(actor.clubId, text(variant.product_id));
    });
  }

  function setProductActive(actor: Actor, productId: string, active: boolean): ProductDetails {
    assertPermission(actor, "products:write");
    return transaction(ctx, () => {
      requireProduct(actor.clubId, productId);
      db.prepare("UPDATE products SET active = ? WHERE id = ?").run(active ? 1 : 0, productId);
      identity.recordAudit(actor, active ? "product.activated" : "product.retired", "product", productId);
      return requireProduct(actor.clubId, productId);
    });
  }

  // ----- holds --------------------------------------------------------------

  /**
   * Expire lapsed pending orders and return their units to the size, exactly once. Must run
   * inside the caller's transaction so no other writer sees stock mid-release.
   */
  function releaseExpiredHolds(): number {
    if (ctx.depth === 0) throw new Error("releaseExpiredHolds must run inside a transaction.");
    const nowIso = ctx.now().toISOString();
    const lapsed = db
      .prepare("SELECT id, variant_id, product_id, quantity FROM merch_orders WHERE status = 'pending_payment' AND hold_expires_at <= ?")
      .all(nowIso) as Row[];
    let released = 0;
    const touched = new Set<string>();
    for (const row of lapsed) {
      const changes = Number(db.prepare("UPDATE merch_orders SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending_payment'").run(nowIso, text(row.id)).changes);
      if (changes === 0) continue;
      db.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(int(row.quantity), text(row.variant_id));
      touched.add(text(row.product_id));
      released += 1;
    }
    for (const productId of touched) syncAggregateStock(productId);
    return released;
  }

  /** Reads call this instead of opening a write transaction: the write lock is taken only when a hold has actually lapsed (audit #13). */
  function releaseIfLapsed(): number {
    const lapsed = db.prepare("SELECT 1 FROM merch_orders WHERE status = 'pending_payment' AND hold_expires_at <= ? LIMIT 1").get(ctx.now().toISOString());
    if (!lapsed) return 0;
    return transaction(ctx, () => releaseExpiredHolds());
  }

  // ----- orders -------------------------------------------------------------

  function requireOrder(clubId: string, orderId: string): MerchOrder {
    const row = db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? AND o.id = ?`).get(clubId, orderId) as Row | undefined;
    if (!row) throw new NotFoundError("Order not found.");
    return mapOrder(row);
  }

  /**
   * Member places an order: the conditional `stock >= quantity` UPDATE inside BEGIN IMMEDIATE
   * reserves the units; the `stock >= 0` CHECK is the backstop. Price is fixed from membershipState now.
   */
  function createOrder(actor: Actor, input: z.input<typeof createOrderSchema>): MerchOrder {
    assertPermission(actor, "orders:create");
    const data = parseInput(createOrderSchema, input);
    return transaction(ctx, () => {
      releaseExpiredHolds();
      const variant = db
        .prepare("SELECT v.*, p.price_paise, p.member_price_paise, p.active FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.club_id = ? AND v.id = ?")
        .get(actor.clubId, data.variantId) as Row | undefined;
      if (!variant) throw new NotFoundError("Product size not found.");
      if (int(variant.active) !== 1) throw new ConflictError("This product is no longer available.", "product_inactive");

      const pending = int(
        (db.prepare("SELECT COALESCE(SUM(quantity), 0) AS units FROM merch_orders WHERE member_id = ? AND variant_id = ? AND status = 'pending_payment'").get(actor.memberId, data.variantId) as Row).units,
      );
      if (pending + data.quantity > MAX_PENDING_UNITS_PER_VARIANT) {
        throw new ConflictError(`You already hold ${pending} unpaid unit(s) of this size; pay or cancel before ordering more.`, "pending_limit");
      }
      const pendingTotal = int(
        (db.prepare("SELECT COALESCE(SUM(quantity), 0) AS units FROM merch_orders WHERE member_id = ? AND status = 'pending_payment'").get(actor.memberId) as Row).units,
      );
      if (pendingTotal + data.quantity > MAX_PENDING_UNITS_PER_MEMBER) {
        throw new ConflictError(`You already hold ${pendingTotal} unpaid unit(s) in total; pay or cancel before ordering more.`, "pending_limit");
      }
      if (int(variant.stock) === 0) throw new ConflictError(`Size ${text(variant.size)} is out of stock.`, "out_of_stock");
      const taken = db.prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?").run(data.quantity, data.variantId, data.quantity);
      if (Number(taken.changes) === 0) throw new ConflictError(`Only ${int(variant.stock)} left in size ${text(variant.size)}.`, "out_of_stock");
      const productId = text(variant.product_id);
      syncAggregateStock(productId);

      const member = identity.requireMember(actor.clubId, actor.memberId);
      const memberPricing = variant.member_price_paise !== null && membershipState(member, clubDate(ctx.now())) === "active";
      const unitPrice = memberPricing ? int(variant.member_price_paise) : int(variant.price_paise);
      const total = unitPrice * data.quantity;
      const id = randomUUID();
      const now = ctx.now();
      const nowIso = now.toISOString();
      const free = total === 0;
      db.prepare(
        `INSERT INTO merch_orders (id, club_id, member_id, product_id, variant_id, quantity, unit_price_paise, total_paise, pricing, status, hold_expires_at, paid_at, payment_reference, confirmed_by, fulfilled_at, fulfilled_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
      ).run(
        id, actor.clubId, actor.memberId, productId, data.variantId, data.quantity, unitPrice, total,
        memberPricing ? "member" : "standard",
        free ? "paid" : "pending_payment",
        free ? null : new Date(now.getTime() + ORDER_HOLD_MS).toISOString(),
        free ? nowIso : null,
        nowIso, nowIso,
      );
      identity.recordAudit(actor, "order.created", "merch_order", id, { variantId: data.variantId, quantity: data.quantity, totalPaise: total });
      return requireOrder(actor.clubId, id);
    });
  }

  /**
   * Officer confirms payment: release expired holds, one conditional UPDATE pending_payment -> paid,
   * exactly one `merch_order` income row. Expired or cancelled holds cannot be revived.
   */
  function confirmOrder(actor: Actor, orderId: string, input: z.input<typeof confirmOrderSchema>): { order: MerchOrder; created: boolean } {
    assertPermission(actor, "payments:confirm");
    const data = parseInput(confirmOrderSchema, input);
    const before = requireOrder(actor.clubId, orderId);
    releaseIfLapsed(); // its own transaction, so a conflict below cannot roll the release back (audit #24)
    return transaction(ctx, () => {
      const nowIso = ctx.now().toISOString();
      // One external payment pays for one order (audit #3); the UNIQUE index is the backstop.
      if (db.prepare("SELECT 1 FROM merch_orders WHERE club_id = ? AND payment_reference = ? AND id <> ?").get(actor.clubId, data.reference, orderId)) {
        throw new ConflictError("This payment reference is already recorded against another order.", "payment_reference_reused");
      }
      const moved = db
        .prepare("UPDATE merch_orders SET status = 'paid', paid_at = ?, payment_reference = ?, confirmed_by = ?, hold_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending_payment'")
        .run(nowIso, data.reference, actor.memberId, nowIso, orderId);
      if (Number(moved.changes) === 0) {
        const fresh = requireOrder(actor.clubId, orderId);
        if (fresh.status === "paid" || fresh.status === "fulfilled") {
          if (fresh.paymentReference !== data.reference) throw new ConflictError("This order was already confirmed with a different payment reference.", "payment_reference_mismatch");
          return { order: fresh, created: false };
        }
        throw new ConflictError("Hold expired, reorder", "hold_expired");
      }
      postLedgerEntry(ctx, {
        kind: "income",
        amountPaise: before.totalPaise,
        description: `Merchandise · ${before.productName} (${before.size}) × ${before.quantity} · ${before.memberName}`,
        source: { type: "merch_order", id: orderId },
        recordedBy: actor.memberId,
        clubId: actor.clubId,
      });
      identity.recordAudit(actor, "order.paid", "merch_order", orderId, { reference: data.reference, amountPaise: before.totalPaise });
      return { order: requireOrder(actor.clubId, orderId), created: true };
    });
  }

  /** Owners cancel their own pending order; officers with payments:confirm cancel any pending hold. Stock returns exactly once. */
  function cancelOrder(actor: Actor, orderId: string): MerchOrder {
    return transaction(ctx, () => {
      const order = requireOrder(actor.clubId, orderId);
      const officer = hasPermission(actor.role, "payments:confirm");
      if (order.memberId !== actor.memberId && !officer) throw new ForbiddenError();
      releaseExpiredHolds();
      const fresh = requireOrder(actor.clubId, orderId);
      if (fresh.status === "cancelled") return fresh;
      if (fresh.status === "paid" || fresh.status === "fulfilled") throw new ConflictError("Paid orders cannot be cancelled here; refunds are outside this MVP.", "refunds_out_of_scope");
      if (fresh.status === "expired") throw new ConflictError("Hold expired, reorder", "hold_expired");
      const nowIso = ctx.now().toISOString();
      const changes = Number(db.prepare("UPDATE merch_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending_payment'").run(nowIso, orderId).changes);
      if (changes === 1) {
        db.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(fresh.quantity, fresh.variantId);
        syncAggregateStock(fresh.productId);
      }
      identity.recordAudit(actor, "order.cancelled", "merch_order", orderId, { byOwner: order.memberId === actor.memberId });
      return requireOrder(actor.clubId, orderId);
    });
  }

  /** Hand-over. Only paid orders can be fulfilled; repeating is a no-op. */
  function fulfilOrder(actor: Actor, orderId: string): MerchOrder {
    assertPermission(actor, "orders:fulfil");
    return transaction(ctx, () => {
      const order = requireOrder(actor.clubId, orderId);
      if (order.status === "fulfilled") return order;
      if (order.status !== "paid") throw new ConflictError("Only paid orders can be fulfilled.", "order_not_paid");
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE merch_orders SET status = 'fulfilled', fulfilled_at = ?, fulfilled_by = ?, updated_at = ? WHERE id = ? AND status = 'paid'").run(nowIso, actor.memberId, nowIso, orderId);
      identity.recordAudit(actor, "order.fulfilled", "merch_order", orderId);
      return requireOrder(actor.clubId, orderId);
    });
  }

  // ----- reads --------------------------------------------------------------

  function myOrders(actor: Actor): MerchOrder[] {
    releaseIfLapsed();
    return (db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? AND o.member_id = ? ORDER BY o.created_at DESC, o.id`).all(actor.clubId, actor.memberId) as Row[]).map(mapOrder);
  }

  /** Officer list; `status` narrows (pending holds for the confirmation desk, paid for hand-over). */
  function listOrders(actor: Actor, status?: MerchOrder["status"]): MerchOrder[] {
    if (!hasPermission(actor.role, "payments:confirm") && !hasPermission(actor.role, "orders:fulfil")) throw new ForbiddenError();
    releaseIfLapsed();
    const rows = status
      ? db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? AND o.status = ? ORDER BY o.hold_expires_at, o.created_at, o.id`).all(actor.clubId, status)
      : db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? ORDER BY o.created_at DESC, o.id`).all(actor.clubId);
    return (rows as Row[]).map(mapOrder);
  }

  return {
    listProducts,
    requireProduct,
    createProduct,
    setVariantStock,
    setProductActive,
    releaseExpiredHolds,
    releaseIfLapsed,
    createOrder,
    confirmOrder,
    cancelOrder,
    fulfilOrder,
    myOrders,
    listOrders,
    requireOrder,
  };
}

export type MerchandiseModule = ReturnType<typeof createMerchandiseModule>;
