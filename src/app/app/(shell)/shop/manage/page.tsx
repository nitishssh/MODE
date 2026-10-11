"use client";

import { useState, type FormEvent } from "react";
import type { ProductDetails } from "@/lib/contracts";
import { api, ApiError, useAction, useLoad } from "../../../_lib/api";
import { paiseToRupees, rupeesToPaise } from "../../../_lib/format";
import { useT } from "../../../_lib/i18n";
import { Alert, Button, Card, EmptyState, ErrorState, FormPanel, Loading, PageHead, Table } from "../../../_components/ui";
import { Icon } from "../../../_components/icons";
import { useSession } from "../../../_lib/session";
import { ShopNav } from "../_nav";

/* Product management in Azman's workspace idiom: an inline task-create-panel form and a panel table. */

type VariantDraft = { size: string; stock: string };
type Errors = Partial<Record<"name" | "description" | "pricePaise" | "memberPricePaise" | "variants", string>>;

function NewProductPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (product: ProductDetails) => void }) {
  const { t, apiError } = useT();
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
    if (name.trim().length < 2) next.name = t("shop.manage.error.nameShort");
    if (pricePaise === null) next.pricePaise = t("shop.manage.error.priceInvalid");
    if (memberPrice.trim() && memberPricePaise === null) next.memberPricePaise = t("shop.manage.error.memberPriceInvalid");
    const cleaned = variants.map((v) => ({ size: v.size.trim().toUpperCase(), stock: Number(v.stock) }));
    if (!cleaned.length || cleaned.some((v) => !v.size || !Number.isInteger(v.stock) || v.stock < 0)) next.variants = t("shop.manage.error.variantsInvalid");
    if (new Set(cleaned.map((v) => v.size)).size !== cleaned.length) next.variants = t("shop.manage.error.sizesUnique");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await action.run("create", async () => {
      try {
        const result = await api.post<{ product: ProductDetails }>("/api/products", { name: name.trim(), description: description.trim(), pricePaise, memberPricePaise, variants: cleaned });
        onCreated(result.product);
      } catch (caught) {
        if (caught instanceof ApiError && caught.details.length) setErrors(Object.fromEntries(caught.details.map((d) => [d.field.split(".")[0], d.message])));
        throw new Error(apiError(caught));
      }
    });
    if (ok) onClose();
  }

  const busy = action.busy === "create";
  return (
    <FormPanel title={t("shop.manage.newProduct")} description={t("shop.manage.panelDescription")} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="task-form-grid">
          <label>{t("col.name")}<input value={name} maxLength={120} autoFocus disabled={busy} onChange={(e) => setName(e.target.value)} /></label>
          <label>{t("shop.manage.price")}<input inputMode="decimal" placeholder={t("shop.manage.pricePlaceholder")} value={price} disabled={busy} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>{t("shop.manage.memberPrice")}<input inputMode="decimal" placeholder={t("shop.manage.memberPricePlaceholder")} value={memberPrice} disabled={busy} onChange={(e) => setMemberPrice(e.target.value)} /></label>
          <label>{t("col.description")}<textarea value={description} maxLength={2000} rows={2} placeholder={t("shop.manage.optional")} disabled={busy} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        <div className="task-form-grid" style={{ marginTop: 16 }}>
          {variants.map((variant, index) => (
            <div key={index} className="expense-action-row" style={{ alignItems: "flex-end" }}>
              <label style={{ flex: 1 }}>{t("shop.manage.sizeN", { n: index + 1 })}<input placeholder={t("shop.manage.sizePlaceholder")} maxLength={20} value={variant.size} disabled={busy} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, size: e.target.value } : v)))} /></label>
              <label style={{ width: 110 }}>{t("shop.manage.stock")}<input type="number" min={0} max={100000} step={1} value={variant.stock} disabled={busy} onChange={(e) => setVariants((c) => c.map((v, i) => (i === index ? { ...v, stock: e.target.value } : v)))} /></label>
              <button type="button" className="button-small red-btn" aria-label={t("shop.manage.removeSizeN", { n: index + 1 })} disabled={busy || variants.length <= 1} onClick={() => setVariants((c) => c.filter((_, i) => i !== index))}>{t("action.remove")}</button>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="button-small green-btn" disabled={busy || variants.length >= 20} onClick={() => setVariants((c) => [...c, { size: "", stock: "0" }])}><Icon name="plus" size={12} />{t("shop.manage.addSize")}</button>
          <span className="subtext">{t("shop.manage.upToSizes")}</span>
        </div>
        {errors.name || errors.pricePaise || errors.memberPricePaise || errors.variants || errors.description ? (
          <p className="form-error" role="alert">{[errors.name, errors.pricePaise, errors.memberPricePaise, errors.description, errors.variants].filter(Boolean).join(" ")}</p>
        ) : null}
        {action.error ? <p className="form-error" role="alert">{action.error}</p> : null}
        <div className="form-actions">
          <button type="submit" className="button primary" disabled={busy}>{busy ? t("shop.manage.creating") : t("shop.manage.createProduct")}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>{t("action.cancel")}</button>
        </div>
      </form>
    </FormPanel>
  );
}

export default function ManageProductsPage() {
  const { can } = useSession();
  const { t, fmt, apiError } = useT();
  const allowed = can("products:write");
  const products = useLoad(() => (allowed ? api.get<{ products: ProductDetails[] }>("/api/products") : Promise.resolve({ products: [] as ProductDetails[] })), [allowed]);
  const [creating, setCreating] = useState(false);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const action = useAction();

  const eyebrow = <>{t("shop.eyebrowClub")} <span>/</span> {t("shop.eyebrow")}</>;

  if (!allowed) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={t("shop.manage.title")} />
        <ShopNav active="shop" />
        <section className="panel"><EmptyState title={t("shop.manage.organizersOnlyTitle")} icon="bag">{t("shop.manage.organizersOnlyBody")}</EmptyState></section>
      </>
    );
  }

  function replaceProduct(product: ProductDetails) {
    products.setData((current) => (current ? { products: current.products.map((p) => (p.id === product.id ? product : p)) } : current));
  }

  async function saveStock(product: ProductDetails, variantId: string) {
    const stock = Number(stockDrafts[variantId]);
    if (!Number.isInteger(stock) || stock < 0) { action.setError(t("shop.manage.error.stockInvalid")); return; }
    await action.run(`stock:${variantId}`, async () => {
      try {
        const result = await api.patch<{ product: ProductDetails }>(`/api/products/variants/${encodeURIComponent(variantId)}`, { stock });
        replaceProduct(result.product);
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      setStockDrafts((c) => { const next = { ...c }; delete next[variantId]; return next; });
      return t("shop.manage.stockUpdated", { name: product.name });
    });
  }

  async function toggleActive(product: ProductDetails) {
    await action.run(`active:${product.id}`, async () => {
      let result: { product: ProductDetails };
      try {
        result = await api.patch<{ product: ProductDetails }>(`/api/products/${encodeURIComponent(product.id)}`, { active: !product.active });
      } catch (caught) {
        throw new Error(apiError(caught));
      }
      replaceProduct(result.product);
      return result.product.active ? t("shop.manage.backInShop", { name: product.name }) : t("shop.manage.retiredNotice", { name: product.name });
    });
  }

  const rows = products.data?.products ?? [];

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={t("shop.manage.title")}
        description={t("shop.manage.description")}
        actions={<Button variant="primary" onClick={() => { setCreating(true); action.clear(); }}><Icon name="plus" size={18} />{t("shop.manage.newProduct")}</Button>}
      />
      <ShopNav active="manage" />
      {action.notice ? <Alert tone="success" onDismiss={action.clear}>{action.notice}</Alert> : null}
      {action.error ? <Alert tone="error" onDismiss={action.clear}>{action.error}</Alert> : null}
      {creating ? <NewProductPanel onClose={() => setCreating(false)} onCreated={(product) => {
        products.setData((c) => (c ? { products: [product, ...c.products] } : { products: [product] }));
        const vars = { name: product.name, count: product.variants.length, price: fmt.currency(product.pricePaise), memberNote: product.memberPricePaise !== null ? t("shop.manage.memberNote", { amount: paiseToRupees(product.memberPricePaise) }) : "" };
        action.setNotice(product.variants.length === 1 ? t("shop.manage.addedOne", vars) : t("shop.manage.addedMany", vars));
      }} /> : null}
      {products.loading && !products.data ? <Loading label={t("shop.manage.loading")} /> : products.error ? <ErrorState error={products.error} onRetry={products.reload} title={t("shop.manage.errorTitle")} /> : (
        <Card kicker={t("shop.manage.kicker")} title={t("shop.manage.catalogue")} flush>
          {!rows.length ? (
            <EmptyState title={t("shop.manage.emptyTitle")} icon="bag" action={<Button variant="primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />{t("shop.manage.addFirst")}</Button>}>{t("shop.manage.emptyBody")}</EmptyState>
          ) : (
            <Table head={<><th scope="col">{t("shop.manage.col.product")}</th><th scope="col" className="amount-cell">{t("col.price")}</th><th scope="col" className="amount-cell">{t("shop.manage.col.memberPrice")}</th><th scope="col">{t("shop.manage.col.sizesStock")}</th><th scope="col">{t("col.status")}</th><th scope="col">{t("col.actions")}</th></>}>
              {rows.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong>{product.description ? <span className="subtext">{product.description}</span> : null}</td>
                  <td className="amount-cell">{fmt.currency(product.pricePaise)}</td>
                  <td className="amount-cell">{product.memberPricePaise === null ? "—" : fmt.currency(product.memberPricePaise)}</td>
                  <td>
                    {product.variants.map((variant) => {
                      const draft = stockDrafts[variant.id];
                      const dirty = draft !== undefined && draft !== String(variant.stock);
                      return (
                        <div key={variant.id} className="expense-action-row" style={{ marginBottom: 6 }}>
                          <strong style={{ minWidth: 70 }}>{variant.size}</strong>
                          <input className="mx-input sm" type="number" min={0} max={100000} step={1} style={{ width: 84 }} aria-label={t("shop.manage.stockFor", { product: product.name, size: variant.size })} value={draft ?? String(variant.stock)} onChange={(e) => setStockDrafts((c) => ({ ...c, [variant.id]: e.target.value }))} />
                          <button type="button" className="button-small green-btn" disabled={!dirty || action.busy === `stock:${variant.id}`} onClick={() => void saveStock(product, variant.id)}>{t("action.save")}</button>
                          {variant.stock === 0 ? <span className="badge red">{t("shop.manage.soldOut")}</span> : null}
                        </div>
                      );
                    })}
                  </td>
                  <td><span className={`badge ${product.active ? "green" : "neutral"}`}>{product.active ? t("status.active") : t("shop.manage.retiredBadge")}</span></td>
                  <td>
                    <button type="button" className={`button-small ${product.active ? "red-btn" : "green-btn"}`} disabled={action.busy === `active:${product.id}`} onClick={() => void toggleActive(product)}>{product.active ? t("shop.manage.retire") : t("shop.manage.reactivate")}</button>
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
