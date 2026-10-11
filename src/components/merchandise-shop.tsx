"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MerchOrder, ProductDetails, ProductVariant, SessionUser } from "@/lib/contracts";
import PolaroidLineCarousel, { type LandPalette } from "@/components/ui/polaroid-line-carousel";
import { merchImage } from "@/lib/merch-art";

type ProductResponse = { products: ProductDetails[] };
type OrderResponse = { orders: MerchOrder[] };

const palettes: LandPalette[] = ["dawn", "alpine", "dusk", "mist"];

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

function messageFrom(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "error" in result && typeof result.error === "string") return result.error;
  return fallback;
}

function statusLabel(status: MerchOrder["status"]) {
  return status.replace("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function MerchandiseShop({ user }: { user: SessionUser }) {
  const officerDesk = user.permissions.includes("payments:confirm") || user.permissions.includes("orders:fulfil");
  const [products, setProducts] = useState<ProductDetails[]>([]);
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [productSearch, setProductSearch] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [productResponse, orderResponse] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch(officerDesk ? "/api/orders" : "/api/orders/mine", { cache: "no-store" }),
      ]);
      const productResult = await productResponse.json() as ProductResponse & { error?: string };
      const orderResult = await orderResponse.json() as OrderResponse & { error?: string };
      if (!productResponse.ok) throw new Error(messageFrom(productResult, "Could not load merchandise."));
      if (!orderResponse.ok) throw new Error(messageFrom(orderResult, "Could not load orders."));
      setProducts(productResult.products.filter((product) => product.active));
      setOrders(orderResult.orders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the merchandise desk.");
    } finally {
      setLoading(false);
    }
  }, [officerDesk]);

  useEffect(() => { void load(); }, [load]);

  const visibleProducts = products.filter((item) => {
    const query = productSearch.trim().toLowerCase();
    return !query || `${item.name} ${item.description ?? ""} ${item.variants.map((variant) => variant.size).join(" ")}`.toLowerCase().includes(query);
  });
  const product = visibleProducts[Math.min(activeIndex, Math.max(0, visibleProducts.length - 1))];
  const firstAvailable = product?.variants.find((variant) => variant.stock > 0) ?? product?.variants[0];
  const selectedVariant = product?.variants.find((variant) => variant.id === variantId) ?? firstAvailable;

  useEffect(() => {
    setVariantId(firstAvailable?.id ?? "");
    setQuantity(1);
    setNotice("");
  }, [product?.id, firstAvailable?.id]);

  useEffect(() => {
    setActiveIndex(0);
  }, [productSearch]);

  const slides = useMemo(() => visibleProducts.map((item, index) => ({
    title: item.name,
    image: merchImage(item.name),
    caption: `${money(item.memberPricePaise ?? item.pricePaise)} · ${item.variants.reduce((sum, variant) => sum + variant.stock, 0)} available`,
    alt: `${item.name} from the MODE club collection`,
    palette: palettes[index % palettes.length],
    seed: item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 19),
  })), [visibleProducts]);

  async function reserve() {
    if (!selectedVariant) return;
    setBusy("reserve");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariant.id, quantity }),
      });
      const result = await response.json() as { order?: MerchOrder; error?: string };
      if (!response.ok || !result.order) throw new Error(messageFrom(result, "Could not reserve this item."));
      const hold = result.order.holdExpiresAt
        ? ` Reserved until ${new Date(result.order.holdExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
        : " The free order was confirmed automatically.";
      setNotice(`${result.order.productName}, ${result.order.size} × ${result.order.quantity} is in your register.${hold}`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reserve this item.");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function act(order: MerchOrder, action: "confirm" | "cancel" | "fulfil") {
    setBusy(`${order.id}:${action}`);
    setError("");
    setNotice("");
    try {
      const body = action === "confirm" ? { reference: (references[order.id] ?? "").trim() } : {};
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(messageFrom(result, `Could not ${action} this order.`));
      setNotice(action === "confirm" ? "Payment recorded." : action === "fulfil" ? "Order marked as handed over." : "Hold cancelled and stock released.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} this order.`);
    } finally {
      setBusy("");
    }
  }

  if (loading) return <div className="loading-state" role="status"><span className="loader" /><span>Arranging the collection…</span></div>;
  if (!products.length) return <section className="panel empty"><h3>The line is empty</h3><p>{error || "No active merchandise is available right now."}</p><button className="button" type="button" onClick={() => void load()}>Check again</button></section>;

  const available = Boolean(selectedVariant && selectedVariant.stock > 0);
  const displayPrice = product?.memberPricePaise ?? product?.pricePaise ?? 0;

  return (
    <div className="merch-experience">
      <label className="merch-search">
        <IconSearch />
        <input
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          placeholder="Search merchandise"
          aria-label="Search merchandise"
        />
      </label>
      {!visibleProducts.length ? (
        <section className="panel empty merch-search-empty">
          <h3>No merchandise found</h3>
          <p>Try a different product name, description, or size.</p>
        </section>
      ) : <>
      <div className="merch-stage">
        <div className="merch-stage-label"><span>MODE / CLUB COLLECTION</span><b>Drag the line or use the arrows</b></div>
        <PolaroidLineCarousel
          slides={slides}
          height="clamp(430px,58vh,610px)"
          cardWidth={290}
          sag={42}
          swing={0.85}
          autoplay={0}
          string="#b68b70"
          background="transparent"
          ink="#fff8ec"
          ariaLabel="Club merchandise carousel"
          onChange={setActiveIndex}
        />
      </div>

      <section className="merch-buy-panel" aria-labelledby="selected-product-title">
        <div className="merch-buy-copy">
          <span className="eyebrow">SELECTED PRINT / {String(activeIndex + 1).padStart(2, "0")}</span>
          <h2 id="selected-product-title">{product.name}</h2>
          <p>{product.description || "A club essential from the MODE collection."}</p>
          <div className="merch-price-line">
            <strong>{money(displayPrice)}</strong>
            {product.memberPricePaise !== null && <span>member price · standard {money(product.pricePaise)}</span>}
          </div>
        </div>

        <div className="merch-order-controls">
          <fieldset>
            <legend>Choose a size</legend>
            <div className="merch-choice-row">
              {product.variants.map((variant) => (
                <VariantButton key={variant.id} variant={variant} selected={variant.id === selectedVariant?.id} onClick={() => { setVariantId(variant.id); if (quantity > variant.stock) setQuantity(1); }} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Quantity</legend>
            <div className="merch-choice-row">
              {[1, 2].map((value) => <button key={value} type="button" className={`merch-choice ${quantity === value ? "selected" : ""}`} disabled={!available || value > (selectedVariant?.stock ?? 0)} onClick={() => setQuantity(value)} aria-pressed={quantity === value}>{value}</button>)}
            </div>
          </fieldset>
          <p className={available ? "merch-stock good" : "merch-stock"}>{selectedVariant ? available ? `${selectedVariant.stock} available in size ${selectedVariant.size}. Stock is checked again when you reserve.` : `Size ${selectedVariant.size} is sold out.` : "No size variants are available."}</p>
          {user.permissions.includes("orders:create") && <button className="button primary merch-reserve" type="button" disabled={!available || busy === "reserve"} onClick={() => void reserve()}>{busy === "reserve" ? "Reserving…" : `Reserve ${selectedVariant?.size ?? "item"} · ${money(displayPrice * quantity)}`}</button>}
        </div>
      </section>
      </>}

      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="error-inline" role="alert">{error}</p>}

      <section className="merch-register" aria-labelledby="merch-register-heading">
        <div className="merch-register-heading"><div><span className="eyebrow">{officerDesk ? "OFFICER ORDER DESK" : "MY ORDER REGISTER"}</span><h2 id="merch-register-heading">{officerDesk ? "Collection and payment" : "Your reservations"}</h2></div><button className="text-button" type="button" disabled={loading} onClick={() => void load()}>Refresh stock ↻</button></div>
        {!orders.length ? <p className="merch-empty-register">No orders yet. Choose a print above to begin.</p> : <div className="merch-orders">{orders.map((order) => {
          const pending = order.status === "pending_payment";
          const canConfirm = pending && user.permissions.includes("payments:confirm");
          const canFulfil = order.status === "paid" && user.permissions.includes("orders:fulfil");
          const canCancel = pending && (order.memberId === user.id || user.permissions.includes("payments:confirm"));
          const orderBusy = busy.startsWith(`${order.id}:`);
          return <article key={order.id} className="merch-order-card">
            <div><span className={`merch-order-status status-${order.status}`}>{statusLabel(order.status)}</span><h3>{order.productName} · {order.size}</h3><p>{order.memberName} · quantity {order.quantity} · {money(order.totalPaise)}</p>{pending && order.holdExpiresAt && <small>Hold until {new Date(order.holdExpiresAt).toLocaleString()}</small>}</div>
            <div className="merch-order-actions">
              {canConfirm && <input aria-label={`Payment reference for ${order.productName}`} placeholder="Payment reference" value={references[order.id] ?? ""} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} />}
              {canConfirm && <button className="button-small green-btn" type="button" disabled={orderBusy || (references[order.id] ?? "").trim().length < 3} onClick={() => void act(order, "confirm")}>Record payment</button>}
              {canFulfil && <button className="button-small green-btn" type="button" disabled={orderBusy} onClick={() => void act(order, "fulfil")}>Handed over</button>}
              {canCancel && <button className="button-small red-btn" type="button" disabled={orderBusy} onClick={() => void act(order, "cancel")}>Cancel hold</button>}
            </div>
          </article>;
        })}</div>}
      </section>
    </div>
  );
}

function IconSearch() {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>;
}

function VariantButton({ variant, selected, onClick }: { variant: ProductVariant; selected: boolean; onClick(): void }) {
  return <button type="button" className={`merch-choice ${selected ? "selected" : ""}`} disabled={variant.stock === 0} onClick={onClick} aria-pressed={selected} aria-label={`Size ${variant.size}, ${variant.stock} available`}>{variant.size}<small>{variant.stock}</small></button>;
}
