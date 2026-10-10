"use client";

import { useState } from "react";
import Link from "next/link";
import type { MerchOrder, ProductDetails } from "@/lib/contracts";
import { api, useAction, useLoad } from "../../_lib/api";
import { useSession } from "../../_lib/session";
import { money } from "../../_lib/format";
import { Alert, Badge, Button, Card, Countdown, EmptyState, ErrorState, LinkButton, PageHead, Skeleton } from "../../_components/ui";
import { Icon } from "../../_components/icons";
import { ShopNav } from "./_nav";

function ProductCard({ product, memberActive, onOrdered }: { product: ProductDetails; memberActive: boolean; onOrdered: (order: MerchOrder) => void }) {
  const inStock = product.variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState(inStock[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const action = useAction();
  const memberApplies = memberActive && product.memberPricePaise !== null;
  const unit = memberApplies ? product.memberPricePaise! : product.pricePaise;

  async function order() {
    const ok = await action.run("order", async () => {
      const result = await api.post<{ order: MerchOrder }>("/api/orders", { variantId, quantity });
      onOrdered(result.order);
    });
    if (ok) action.clear();
  }

  return (
    <Card>
      <div className="mx-stack-sm">
        <div className="mx-between">
          <h3 className="mx-h3" style={{ fontFamily: "var(--mx-display)", fontSize: 20 }}>{product.name}</h3>
          {memberApplies ? <Badge tone="green" dot>Member price</Badge> : null}
        </div>
        {product.description ? <p className="mx-muted">{product.description}</p> : null}
        <div className="mx-row" style={{ alignItems: "baseline" }}>
          <span className="mx-stat-value" style={{ fontSize: 24 }}>{money(unit)}</span>
          {product.memberPricePaise !== null ? (
            memberApplies
              ? <span className="mx-muted mx-small">Standard {money(product.pricePaise)}</span>
              : <span className="mx-muted mx-small">Members pay {money(product.memberPricePaise)}</span>
          ) : null}
        </div>
        <div>
          <p className="mx-label" style={{ marginBottom: 6 }}>Size</p>
          <div className="mx-row" style={{ gap: 6 }}>
            {product.variants.map((variant) => {
              const soldOut = variant.stock <= 0;
              const selected = variant.id === variantId;
              return (
                <button key={variant.id} type="button" disabled={soldOut} aria-pressed={selected} onClick={() => setVariantId(variant.id)} className={`mx-btn sm ${selected ? "primary" : ""}`.trim()} title={soldOut ? "Sold out" : `${variant.stock} available`}>
                  {variant.size}{soldOut ? " · Sold out" : ""}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mx-row">
          <label className="mx-label" htmlFor={`qty-${product.id}`}>Quantity</label>
          <select id={`qty-${product.id}`} className="mx-select sm" style={{ width: 80 }} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          <span className="mx-muted mx-small">Total {money(unit * quantity)}</span>
          <Button variant="accent" className="mx-right" loading={action.busy === "order"} disabled={!variantId || !inStock.length} onClick={() => void order()}><Icon.bag />{inStock.length ? "Order" : "Sold out"}</Button>
        </div>
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      </div>
    </Card>
  );
}

export default function ShopPage() {
  const { pass } = useSession();
  const products = useLoad(() => api.get<{ products: ProductDetails[] }>("/api/products"));
  const [placed, setPlaced] = useState<MerchOrder | null>(null);
  const memberActive = pass?.membership === "active";
  const active = (products.data?.products ?? []).filter((p) => p.active);

  function onOrdered(order: MerchOrder) {
    setPlaced(order);
    void products.reload();
  }

  return (
    <>
      <PageHead eyebrow="Club shop" title="Merchandise" description="Pay at the desk within 30 minutes; an officer confirms your payment reference. Your size is held until then." />
      <ShopNav active="shop" />
      {placed ? (
        <div className="mx-mb">
          <Alert tone="success" onDismiss={() => setPlaced(null)}>
            <strong>Order placed:</strong> {placed.productName} · {placed.size} × {placed.quantity} for {money(placed.totalPaise)}.{" "}
            {placed.status === "pending_payment" ? <>Hold expires in <Countdown until={placed.holdExpiresAt} />. </> : <>Marked paid (no payment needed). </>}
            <Link href="/app/shop/orders" className="mx-link">View my orders</Link>
          </Alert>
        </div>
      ) : null}
      {!memberActive && active.some((p) => p.memberPricePaise !== null) ? (
        <div className="mx-mb"><Alert tone="info">Member prices apply once your membership is active. Ask an officer to record your dues.</Alert></div>
      ) : null}
      {products.loading && !products.data ? <Skeleton rows={6} /> : products.error ? <ErrorState error={products.error} onRetry={products.reload} /> : !active.length ? (
        <EmptyState title="Nothing in the shop yet">Products appear here once an organizer adds them.</EmptyState>
      ) : (
        <div className="mx-grid mx-grid-3">
          {active.map((product) => <ProductCard key={product.id} product={product} memberActive={memberActive} onOrdered={onOrdered} />)}
        </div>
      )}
      <div className="mx-mt mx-row">
        <LinkButton href="/app/shop/orders" size="sm">My orders<Icon.arrow /></LinkButton>
      </div>
    </>
  );
}
