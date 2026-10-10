import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Order, ProductDetails, ProductVariant } from "../contracts";
import { hasPermission } from "../auth/permissions";
import { int, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { LedgerModule } from "./ledger";
import type { MembershipModule } from "./membership";

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).default(""),
    pricePaise: z.number().int().min(0),
    memberPricePaise: z.number().int().min(0).nullable().default(null),
    variants: z.array(z.object({ size: z.string().trim().min(1).max(20), stock: z.number().int().min(0) })).min(1).max(20),
  })
  .strict();

export const variantStockSchema = z.object({ stock: z.number().int().min(0) }).strict();
export const orderInputSchema = z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(20).default(1) }).strict();
export const confirmOrderSchema = z
  .object({ paymentReference: z.string().trim().min(3).max(120), amountPaise: z.number().int().positive() })
  .strict();

function mapOrder(row: Row): Order {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    productId: text(row.product_id),
    productName: text(row.product_name),
    variantId: text(row.variant_id),
    size: text(row.size),
    quantity: int(row.quantity),
    unitPricePaise: int(row.unit_price_paise),
    totalPaise: int(row.total_paise),
    pricing: row.pricing as Order["pricing"],
    status: row.status as Order["status"],
    fulfilment: row.fulfilment as Order["fulfilment"],
    paymentId: nullableText(row.payment_id),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

const ORDER_SELECT = `SELECT o.*, p.name AS product_name, v.size FROM orders o JOIN products p ON p.id = o.product_id JOIN product_variants v ON v.id = o.variant_id`;

export function createMerchandiseModule(
  ctx: DbContext,
  identity: IdentityModule,
  membership: MembershipModule,
  ledger: LedgerModule,
) {
  const { db } = ctx;

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

  /** Keep the starter's aggregate `products.stock` equal to the sum of its variants. */
  function syncAggregateStock(productId: string): void {
    db.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(stock), 0) FROM product_variants WHERE product_id = ?) WHERE id = ?").run(productId, productId);
  }

  function createProduct(actor: Actor, input: z.infer<typeof productInputSchema>): ProductDetails {
    assertPermission(actor, "products:write");
    const data = productInputSchema.parse(input);
    const sizes = new Set(data.variants.map((variant) => variant.size.toUpperCase()));
    if (sizes.size !== data.variants.length) throw new ValidationError("Each size may appear only once.", [{ field: "variants", message: "Duplicate size." }]);
    return transaction(ctx, () => {
      const id = randomUUID();
      db.prepare("INSERT INTO products (id, name, price_paise, stock, club_id, description, member_price_paise, active) VALUES (?, ?, ?, 0, ?, ?, ?, 1)").run(
        id,
        data.name,
        data.pricePaise,
        actor.clubId,
        data.description,
        data.memberPricePaise,
      );
      const insert = db.prepare("INSERT INTO product_variants VALUES (?, ?, ?, ?, ?)");
      for (const variant of data.variants) insert.run(randomUUID(), actor.clubId, id, variant.size.toUpperCase(), variant.stock);
      syncAggregateStock(id);
      identity.recordAudit(actor, "product.created", "product", id, { name: data.name });
      return requireProduct(actor.clubId, id);
    });
  }

  function setVariantStock(actor: Actor, variantId: string, stock: number): ProductDetails {
    assertPermission(actor, "products:write");
    variantStockSchema.parse({ stock });
    return transaction(ctx, () => {
      const variant = db.prepare("SELECT product_id FROM product_variants WHERE club_id = ? AND id = ?").get(actor.clubId, variantId) as Row | undefined;
      if (!variant) throw new NotFoundError("Product size not found.");
      db.prepare("UPDATE product_variants SET stock = ? WHERE id = ?").run(stock, variantId);
      syncAggregateStock(text(variant.product_id));
      identity.recordAudit(actor, "variant.stock_set", "product_variant", variantId, { stock });
      return requireProduct(actor.clubId, text(variant.product_id));
    });
  }

  function requireOrder(clubId: string, orderId: string): Order {
    const row = db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? AND o.id = ?`).get(clubId, orderId) as Row | undefined;
    if (!row) throw new NotFoundError("Order not found.");
    return mapOrder(row);
  }

  /**
   * Create an order and decrement the chosen size atomically. The conditional
   * UPDATE (`stock >= quantity`) plus the `stock >= 0` CHECK make overselling impossible.
   */
  function createOrder(actor: Actor, input: z.infer<typeof orderInputSchema>): Order {
    assertPermission(actor, "orders:create");
    const data = orderInputSchema.parse(input);
    return transaction(ctx, () => {
      const variant = db
        .prepare("SELECT v.*, p.price_paise, p.member_price_paise, p.active FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.club_id = ? AND v.id = ?")
        .get(actor.clubId, data.variantId) as Row | undefined;
      if (!variant) throw new NotFoundError("Product size not found.");
      if (int(variant.active) !== 1) throw new ConflictError("This product is no longer available.", "product_inactive");
      const taken = db.prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?").run(data.quantity, data.variantId, data.quantity);
      if (Number(taken.changes) === 0) {
        throw new ConflictError(`Only ${int(variant.stock)} left in size ${text(variant.size)}.`, "out_of_stock");
      }
      const productId = text(variant.product_id);
      syncAggregateStock(productId);

      const memberPricing = variant.member_price_paise !== null && membership.statusFor(actor.clubId, actor.memberId).memberPricing;
      const unitPrice = memberPricing ? int(variant.member_price_paise) : int(variant.price_paise);
      const total = unitPrice * data.quantity;
      const id = randomUUID();
      const nowIso = ctx.now().toISOString();
      db.prepare(
        `INSERT INTO orders (id, club_id, member_id, product_id, variant_id, quantity, unit_price_paise, total_paise, pricing, status, fulfilment, payment_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unfulfilled', NULL, ?, ?)`,
      ).run(id, actor.clubId, actor.memberId, productId, data.variantId, data.quantity, unitPrice, total, memberPricing ? "member" : "guest", total === 0 ? "paid" : "pending_payment", nowIso, nowIso);
      identity.recordAudit(actor, "order.created", "order", id, { variantId: data.variantId, quantity: data.quantity, totalPaise: total });
      return requireOrder(actor.clubId, id);
    });
  }

  /** Confirm payment once; the same reference replays safely and posts a single ledger row. */
  function confirmOrder(actor: Actor, orderId: string, input: z.infer<typeof confirmOrderSchema>): { order: Order; created: boolean } {
    assertPermission(actor, "payments:confirm");
    const data = confirmOrderSchema.parse(input);
    return transaction(ctx, () => {
      const order = requireOrder(actor.clubId, orderId);
      const existingPayment = membership.findPayment(actor.clubId, data.paymentReference);
      if (order.status === "paid") {
        if (existingPayment && existingPayment.id === order.paymentId) return { order, created: false };
        throw new ConflictError("This order is already paid with a different payment.", "already_paid");
      }
      if (order.status === "cancelled") throw new ConflictError("This order was cancelled; place a new order.", "order_cancelled");
      if (data.amountPaise !== order.totalPaise) {
        throw new ValidationError(`This order totals ${order.totalPaise} paise.`, [{ field: "amountPaise", message: `Expected ${order.totalPaise}.` }]);
      }
      const { payment, created } = membership.recordPayment({
        clubId: actor.clubId,
        memberId: order.memberId,
        purpose: "order",
        targetId: order.id,
        reference: data.paymentReference,
        amountPaise: order.totalPaise,
        recordedBy: actor.memberId,
      });
      if (!created && payment.targetId !== order.id) {
        throw new ConflictError("This payment reference belongs to a different order.", "payment_reference_reused");
      }
      db.prepare("UPDATE orders SET status = 'paid', payment_id = ?, updated_at = ? WHERE id = ?").run(payment.id, ctx.now().toISOString(), order.id);
      if (!ledger.hasEntryFor({ type: "payment", id: payment.id })) {
        ledger.postEntry({
          clubId: actor.clubId,
          kind: "income",
          category: "merchandise",
          amountPaise: payment.amountPaise,
          description: `Merchandise · ${order.productName} (${order.size}) × ${order.quantity}`,
          source: { type: "payment", id: payment.id },
          memberId: order.memberId,
        });
      }
      identity.recordAudit(actor, "order.paid", "order", order.id, { paymentId: payment.id });
      return { order: requireOrder(actor.clubId, order.id), created: true };
    });
  }

  /** Cancel and return stock. Members cancel their own unpaid orders; officers may also cancel paid, unfulfilled ones. */
  function cancelOrder(actor: Actor, orderId: string): Order {
    return transaction(ctx, () => {
      const order = requireOrder(actor.clubId, orderId);
      const officer = hasPermission(actor.role, "products:write");
      if (order.memberId !== actor.memberId && !officer) throw new ForbiddenError();
      if (order.status === "cancelled") return order;
      if (order.fulfilment === "fulfilled") throw new ConflictError("Fulfilled orders cannot be cancelled.", "order_fulfilled");
      if (order.status === "paid" && !officer) throw new ForbiddenError("Ask an organizer to cancel a paid order.");
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(nowIso, order.id);
      db.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").run(order.quantity, order.variantId);
      syncAggregateStock(order.productId);
      identity.recordAudit(actor, "order.cancelled", "order", order.id, { previousStatus: order.status, paid: order.paymentId !== null });
      return requireOrder(actor.clubId, order.id);
    });
  }

  function fulfilOrder(actor: Actor, orderId: string): Order {
    assertPermission(actor, "orders:fulfil");
    return transaction(ctx, () => {
      const order = requireOrder(actor.clubId, orderId);
      if (order.status !== "paid") throw new ConflictError("Only paid orders can be fulfilled.", "order_not_paid");
      if (order.fulfilment === "fulfilled") return order;
      db.prepare("UPDATE orders SET fulfilment = 'fulfilled', updated_at = ? WHERE id = ?").run(ctx.now().toISOString(), order.id);
      identity.recordAudit(actor, "order.fulfilled", "order", order.id);
      return requireOrder(actor.clubId, order.id);
    });
  }

  function myOrders(actor: Actor): Order[] {
    return (db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? AND o.member_id = ? ORDER BY o.created_at DESC`).all(actor.clubId, actor.memberId) as Row[]).map(mapOrder);
  }

  function listOrders(actor: Actor): Order[] {
    assertPermission(actor, "orders:fulfil");
    return (db.prepare(`${ORDER_SELECT} WHERE o.club_id = ? ORDER BY o.created_at DESC`).all(actor.clubId) as Row[]).map(mapOrder);
  }

  return { listProducts, requireProduct, createProduct, setVariantStock, createOrder, confirmOrder, cancelOrder, fulfilOrder, myOrders, listOrders, requireOrder };
}

export type MerchandiseModule = ReturnType<typeof createMerchandiseModule>;
