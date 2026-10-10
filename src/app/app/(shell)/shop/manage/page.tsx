"use client";

import { useState, type FormEvent } from "react";
import type { ProductDetails } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { money, paiseToRupees, rupeesToPaise } from "../../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, FormPanel, Loading, PageHead, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

/* Product management in Azman's workspace idiom: an inline task-create-panel form and a panel table. */

type VariantDraft = { size: string; stock: string };
type Errors = Partial<Record<"name" | "description" | "pricePaise" | "memberPricePaise" | "variants", string>>;

function NewProductPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (product: ProductDetails) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([{ size: "ONE SIZE", stock: "10" }]);
  const [errors, setErrors] = useState<Errors>({});
  const action = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const pricePaise = rupeesToPaise(price);
    const memberPricePaise = memberPrice.trim() ? rupeesToPaise(memberPrice) : null;
    if (name.trim().length < 2) next.name = "Name needs at least 2 characters.";
    if (pricePaise === null) next.pricePaise = "Enter a price in rupees, e.g. 349 or 349.50.";
    if (memberPrice.trim() && memberPricePaise === null) next.memberPricePaise = "Enter a valid rupee amount or leave blank.";
    const cleaned = variants.map((v) => ({ size: v.size.trim().toUpperCase(), stock: Number(v.stock) }));
    if (!cleaned.length || cleaned.some((v) => !v.size || !Number.isInteger(v.stock) || v.stock < 0)) next.variants = "Every size needs a label and a whole-number stock.";
    if (new Set(cleaned.map((v) => v.size)).size !== cleaned.length) next.variants = "Sizes must be unique.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await action.run("create", async () => {
      try {
        const result = await api.post<{ product: ProductDetails }>("/api/products", { name: name.trim(), description: description.trim(), pricePaise, memberPricePaise, variants: cleaned });
        onCreated(result.product);
      } catch (caught) {
        if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field.split(".")[0], d.message])));
        throw caught;
      }
    });
    if (ok) onClose();
  }

  const busy = action.busy === "create";
  return (
    <FormPanel title="New product" description="Each size tracks its own stock. Member price is optional." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label>Name<input value={name} maxLength={120} autoFocus disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
          <label>Price (₹)<input inputMode="decimal" placeholder="349.00" value={price} disabled={busy} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Member price (₹, optional)<input inputMode="decimal" placeholder="Leave blank for no discount" value={memberPrice} disabled={busy} onChange={(e) => setMemberPrice(e.target.value)} /></label>
          <label>Description<textarea value={description} maxLength={2000} rows={2} placeholder="Optional" disabled={busy} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        <div className="task-form-grid" style={{ marginTop: 16 }}>
          {variants.map((variant, index) => (
            <div key={index} className="expense-action-row" style={{ alignItems: "flex-end" }}>
              <label style={{ flex: 1 }}>Size {index + 1}<input placeholder="e.g. M" maxLength={20} value={variant.size} disabled={busy} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, size: e.target.value } : v)))} /></label>
              <label style={{ width: 110 }}>Stock<input type="number" min={0} max={100000} step={1} value={variant.stock} disabled={busy} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, stock: e.target.value } : v)))} /></label>
              <button type="button" className="button-small red-btn" aria-label={`Remove size ${index + 1}`} disabled={busy || variants.length <= 1} onClick={() => setVariants((c) => c.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="button-small green-btn" disabled={busy || variants.length >= 20} onClick={() => setVariants((c) => [...c, { size: "", stock: "0" }])}><Icon name="plus" size={12} />Add size</button>
          <span className="subtext">Up to 20 sizes.</span>
        </div>
        {errors.name || errors.pricePaise || errors.memberPricePaise || errors.variants || errors.description ? (
          <p className="form-error" role="alert">{[errors.name, errors.pricePaise, errors.memberPricePaise, errors.description, errors.variants].filter(Boolean).join(" ")}</p>
        ) : null}
        {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Creating…" : "Create product"}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </FormPanel>
  );
}

export default function ManageProductsPage() {
  const { can } = useSession();
  const allowed = can("products:write");
  const products = useLoad(() => (allowed ? api.get<{ products: ProductDetails[] }>("/api/products") : Promise.resolve({ products: [] as ProductDetails[] })), [allowed]);
  const [creating, setCreating] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const action = useAction();

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={<>CLUB <span>/</span> MERCHANDISE</>} title="Manage products" />
        <ShopNav active="shop" />
        <section className="panel"><EmptyState title="Organizers only" icon="bag">Adding products and editing stock needs the organizer or admin role.</EmptyState></section>
      </>
    );
  }

  function replaceProduct(product: ProductDetails) {
    products.setData((current) => (current ? { products: current.products.map((p) => (p.id === product.id ? product : p)) } : current));
  }

  async function saveStock(product: ProductDetails, variantId: string) {
    const stock = Number(stockDrafts[variantId]);
    if (!Number.isInteger(stock) || stock < 0) { action.setError("Stock must be a whole number of 0 or more."); return; }
    await action.run(`stock:${variantId}`, async () => {
      const result = await api.patch<{ product: ProductDetails }>(`/api/products/variants/${encodeURIComponent(variantId)}`, { stock });
      replaceProduct(result.product);
      setStockDrafts((c) => { const next = { ...c }; delete next[variantId]; return next; });
      return `Stock updated for ${product.name}.`;
    });
  }

  async function toggleActive(product: ProductDetails) {
    await action.run(`active:${product.id}`, async () => {
      const result = await api.patch<{ product: ProductDetails }>(`/api/products/${encodeURIComponent(product.id)}`, { active: !product.active });
      replaceProduct(result.product);
      return result.product.active ? `${product.name} is back in the shop.` : `${product.name} retired. Existing orders are unaffected.`;
    });
  }

  const rows = products.data?.products ?? [];

  return (
    <>
      <PageHead
        eyebrow={<>CLUB <span>/</span> MERCHANDISE</>}
        title="Manage products"
        description="Stock shown is what members can order right now; held units are already subtracted."
        actions={<Button variant="primary" onClick={() => { setCreating(true); action.clear(); }}><Icon name="plus" size={18} />New product</Button>}
      />
      <ShopNav active="manage" />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {creating ? <NewProductPanel onClose={() => setCreating(false)} onCreated={(product) => { products.setData((c) => (c ? { products: [product, ...c.products] } : { products: [product] })); action.setNotice(`${product.name} added with ${product.variants.length} size${product.variants.length === 1 ? "" : "s"} at ${money(product.pricePaise)}${product.memberPricePaise !== null ? ` (₹${paiseToRupees(product.memberPricePaise)} for members)` : ""}.`); }} /> : null}
      {products.loading && !products.data ? <Loading label="Loading the catalogue…" /> : products.error ? <ErrorState error={products.error} onRetry={products.reload} title="The catalogue could not load" /> : (
        <Card kicker="CLUB COLLECTION" title="Catalogue" flush>
          {!rows.length ? (
            <EmptyState title="No products yet" icon="bag" action={<Button variant="primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Add the first product</Button>}>Add a product with at least one size.</EmptyState>
          ) : (
            <Table head={<><th scope="col">Product</th><th scope="col" className="amount-cell">Price</th><th scope="col" className="amount-cell">Member price</th><th scope="col">Sizes and stock</th><th scope="col">Status</th><th scope="col">Actions</th></>}>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong>{product.description ? <span className="subtext">{product.description}</span> : null}</td>
                  <td className="amount-cell">{money(product.pricePaise)}</td>
                  <td className="amount-cell">{product.memberPricePaise === null ? "—" : money(product.memberPricePaise)}</td>
                  <td>
                    {product.variants.map((variant) => {
                      const draft = stockDrafts[variant.id];
                      const dirty = draft !== undefined && draft !== String(variant.stock);
                      return (
                        <div key={variant.id} className="expense-action-row" style={{ marginBottom: 6 }}>
                          <strong style={{ minWidth: 70 }}>{variant.size}</strong>
                          <input className="mx-input sm" type="number" min={0} max={100000} step={1} style={{ width: 84 }} aria-label={`Stock for ${product.name} ${variant.size}`} value={draft ?? String(variant.stock)} onChange={(e) => setStockDrafts((c) => ({ ...c, [variant.id]: e.target.value }))} />
                          <button type="button" className="button-small green-btn" disabled={!dirty || action.busy === `stock:${variant.id}`} onClick={() => void saveStock(product, variant.id)}>Save</button>
                          {variant.stock === 0 ? <span className="badge red">Sold out</span> : null}
                        </div>
                      );
                    })}
                  </td>
                  <td><span className={`badge ${product.active ? "green" : "neutral"}`}>{product.active ? "Active" : "Retired"}</span></td>
                  <td>
                    <button type="button" className={`button-small ${product.active ? "red-btn" : "green-btn"}`} disabled={action.busy === `active:${product.id}`} onClick={() => void toggleActive(product)}>{product.active ? "Retire" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
