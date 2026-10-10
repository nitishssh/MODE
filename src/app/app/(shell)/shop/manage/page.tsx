"use client";

import { useState, type FormEvent } from "react";
import type { ProductDetails } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { money, paiseToRupees, rupeesToPaise } from "../../../_lib/format";
import { Alert, Badge, Button, EmptyState, ErrorState, Input, Modal, PageHead, Skeleton, Table, TextField, TextareaField } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

type VariantDraft = { size: string; stock: string };
type Errors = Partial<Record<"name" | "description" | "pricePaise" | "memberPricePaise" | "variants", string>>;

function NewProductModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (product: ProductDetails) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([{ size: "ONE SIZE", stock: "10" }]);
  const [errors, setErrors] = useState<Errors>({});
  const action = useAction();

  function reset() {
    setName(""); setDescription(""); setPrice(""); setMemberPrice(""); setVariants([{ size: "ONE SIZE", stock: "10" }]); setErrors({}); action.clear();
  }

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
        if (caught instanceof ApiError && caught.details.length) {
          setErrors(Object.fromEntries(caught.details.map((d) => [d.field.split(".")[0], d.message])));
        }
        throw caught;
      }
    });
    if (ok) { reset(); onClose(); }
  }

  return (
    <Modal open={open} title="New product" description="Each size tracks its own stock. Member price is optional." onClose={() => { reset(); onClose(); }}>
      <form className="mx-form" onSubmit={submit} noValidate>
        {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus maxLength={120} />
        <TextareaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={2000} placeholder="Optional" />
        <div className="mx-form-row">
          <TextField label="Price (₹)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.pricePaise} placeholder="349.00" />
          <TextField label="Member price (₹)" inputMode="decimal" value={memberPrice} onChange={(e) => setMemberPrice(e.target.value)} error={errors.memberPricePaise} hint="Leave blank for no member discount." placeholder="Optional" />
        </div>
        <div className="mx-field">
          <label>Sizes and stock</label>
          <div className="mx-stack-sm">
            {variants.map((variant, index) => (
              <div key={index} className="mx-row" style={{ flexWrap: "nowrap" }}>
                <Input className="sm" placeholder="Size (e.g. M)" aria-label={`Size ${index + 1}`} value={variant.size} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, size: e.target.value } : v)))} maxLength={20} />
                <Input className="sm" type="number" min={0} max={100000} step={1} placeholder="Stock" aria-label={`Stock for size ${index + 1}`} value={variant.stock} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, stock: e.target.value } : v)))} style={{ width: 110 }} />
                <Button size="sm" variant="ghost" aria-label="Remove size" disabled={variants.length <= 1} onClick={() => setVariants((c) => c.filter((_, i) => i !== index))}><Icon.close /></Button>
              </div>
            ))}
          </div>
          {errors.variants ? <span className="mx-error" role="alert">{errors.variants}</span> : <span className="mx-hint">Up to 20 sizes.</span>}
          <div><Button size="sm" disabled={variants.length >= 20} onClick={() => setVariants((c) => [...c, { size: "", stock: "0" }])}><Icon.plus />Add size</Button></div>
        </div>
        <div className="mx-form-actions">
          <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button type="submit" variant="primary" loading={action.busy === "create"}>Create product</Button>
        </div>
      </form>
    </Modal>
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
        <PageHead eyebrow="Club shop" title="Manage products" />
        <ShopNav active="shop" />
        <EmptyState title="Organizers only">Adding products and editing stock needs the organizer or admin role.</EmptyState>
      </>
    );
  }

  function replaceProduct(product: ProductDetails) {
    products.setData((current) => (current ? { products: current.products.map((p) => (p.id === product.id ? product : p)) } : current));
  }

  async function saveStock(product: ProductDetails, variantId: string) {
    const raw = stockDrafts[variantId];
    const stock = Number(raw);
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
      <PageHead eyebrow="Club shop" title="Manage products" description="Stock shown is what members can order right now; held units are already subtracted." actions={<Button variant="primary" onClick={() => setCreating(true)}><Icon.plus />New product</Button>} />
      <ShopNav active="manage" />
      {action.error ? <div className="mx-mb"><Alert tone="error" onDismiss={action.clear}>{action.error}</Alert></div> : null}
      {action.notice ? <div className="mx-mb"><Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert></div> : null}
      {products.loading && !products.data ? <Skeleton rows={5} /> : products.error ? <ErrorState error={products.error} onRetry={products.reload} /> : !rows.length ? (
        <EmptyState title="No products yet" action={<Button variant="primary" onClick={() => setCreating(true)}><Icon.plus />Add the first product</Button>}>Add a product with at least one size.</EmptyState>
      ) : (
        <Table head={<><th>Product</th><th className="num">Price</th><th className="num">Member price</th><th>Sizes and stock</th><th>Status</th><th className="actions" /></>}>
          {rows.map((product) => (
            <tr key={product.id}>
              <td><span className="mx-cell-title">{product.name}</span>{product.description ? <span className="mx-cell-sub">{product.description}</span> : null}</td>
              <td className="num">{money(product.pricePaise)}</td>
              <td className="num">{product.memberPricePaise === null ? <span className="mx-muted">—</span> : money(product.memberPricePaise)}</td>
              <td>
                <div className="mx-stack-sm">
                  {product.variants.map((variant) => {
                    const draft = stockDrafts[variant.id];
                    const dirty = draft !== undefined && draft !== String(variant.stock);
                    return (
                      <div key={variant.id} className="mx-row" style={{ flexWrap: "nowrap" }}>
                        <span className="mx-mono" style={{ minWidth: 70 }}>{variant.size}</span>
                        <Input className="sm" type="number" min={0} max={100000} step={1} style={{ width: 90 }} aria-label={`Stock for ${product.name} ${variant.size}`} value={draft ?? String(variant.stock)} onChange={(e) => setStockDrafts((c) => ({ ...c, [variant.id]: e.target.value }))} />
                        <Button size="sm" disabled={!dirty} loading={action.busy === `stock:${variant.id}`} onClick={() => void saveStock(product, variant.id)}>Save</Button>
                        {variant.stock === 0 ? <Badge tone="red">Sold out</Badge> : null}
                      </div>
                    );
                  })}
                </div>
              </td>
              <td><Badge tone={product.active ? "green" : "neutral"} dot>{product.active ? "Active" : "Retired"}</Badge></td>
              <td className="actions"><Button size="sm" variant={product.active ? "danger" : "primary"} loading={action.busy === `active:${product.id}`} onClick={() => void toggleActive(product)}>{product.active ? "Retire" : "Reactivate"}</Button></td>
            </tr>
          ))}
        </Table>
      )}
      <NewProductModal open={creating} onClose={() => setCreating(false)} onCreated={(product) => { products.setData((c) => (c ? { products: [product, ...c.products] } : { products: [product] })); action.setNotice(`${product.name} added with ${product.variants.length} size${product.variants.length === 1 ? "" : "s"} at ${money(product.pricePaise)}${product.memberPricePaise !== null ? ` (${paiseToRupees(product.memberPricePaise)} for members)` : ""}.`); }} />
    </>
  );
}
