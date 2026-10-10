import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { ProductCreate } from "../../components/setup-forms";
import type { MerchOrder, ProductDetails, ProductVariant } from "../../generated/contracts";
import { useResource } from "../../lib/use-resource";
import { useSession } from "../../lib/session";
import { canCreateProduct, canReserveMerchandise, canViewOfficerOrders, orderActions, orderStatusLabel } from "../../lib/commerce-actions";
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, PaperCard, Screen, StatusBadge, money, useTheme } from "../../components/ui";
import { Field, useWrite, WriteNotice } from "../../components/forms";

export default function Shop() {
  const { user } = useSession();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const products = useResource<{ products: ProductDetails[] }>("/api/products");
  const officerDesk = canViewOfficerOrders(user);
  const orders = useResource<{ orders: MerchOrder[] }>(officerDesk ? "/api/orders" : "/api/orders/mine");
  const refresh = async () => { await Promise.all([products.reload(), orders.reload()]); };
  const activeProducts = products.data?.products.filter((product) => product.active) ?? [];
  return <Screen title="Club merchandise" eyebrow="MODE / STOCK & HOLDS">
    <Copy>Choose a size and quantity. MODE reserves stock for 30 minutes and the server fixes the eligible price. Payment is recorded by a club officer—there is no online gateway.</Copy>
    <View style={{ flexDirection: width >= 720 ? "row" : "column", alignItems: width >= 720 ? "center" : "flex-start", gap: 12 }}>
      <Action onPress={() => void refresh()} disabled={products.loading || orders.loading}>Refresh stock and orders</Action>
      <AsOf time={products.time} refreshing={products.loading} />
      {canCreateProduct(user) && <ProductCreate refresh={refresh} />}
    </View>
    <ErrorNotice error={products.error ?? orders.error} />
    {products.loading && !products.data && <LoadingRows />}
    {!products.loading && activeProducts.length === 0 && <PaperCard><Copy kind="title">The shop shelf is empty</Copy><Copy>No active merchandise is available. Check again later.</Copy></PaperCard>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {activeProducts.map((product) => <ProductCard key={product.id} product={product} wide={width >= 820} refresh={refresh} />)}
    </View>
    <View style={{ marginTop: 14, gap: 6 }}>
      <Copy kind="mono" style={{ color: theme.terracottaInk, fontSize: 11 }}>{officerDesk ? "OFFICER ORDER DESK" : "MY ORDER REGISTER"}</Copy>
      <Copy kind="title">{officerDesk ? "Orders requiring club follow-up" : "Your orders"}</Copy>
      <Copy>{officerDesk ? "Only controls allowed by your current permissions and each order’s state are shown." : "Pending holds can be cancelled here. Payment confirmation and hand-over are officer actions."}</Copy>
    </View>
    {orders.loading && !orders.data && <LoadingRows />}
    {!orders.loading && orders.data?.orders.length === 0 && <PaperCard><Copy>No orders yet.</Copy></PaperCard>}
    <View style={{ gap: 14 }}>{orders.data?.orders.map((order) => <OrderCard key={order.id} order={order} refresh={refresh} />)}</View>
  </Screen>;
}

function ProductCard({ product, wide, refresh }: { product: ProductDetails; wide: boolean; refresh(): Promise<void> }) {
  const { user, client } = useSession();
  const theme = useTheme();
  const write = useWrite();
  const firstAvailable = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const selected = product.variants.find((variant) => variant.id === variantId) ?? firstAvailable;
  const available = Boolean(selected && selected.stock > 0);
  const reserve = () => write.run(async () => {
    try {
      const result = await client.request<{ order: MerchOrder }>("/api/orders", { method: "POST", body: JSON.stringify({ variantId: selected?.id, quantity }) });
      const holdCopy = result.order.holdExpiresAt
        ? ` until ${new Date(result.order.holdExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : ". This free order was confirmed automatically";
      write.setNotice(`Reserved ${result.order.size} × ${result.order.quantity} at ${money(result.order.totalPaise)}${holdCopy}.`);
    } finally { await refresh(); }
  });
  return <PaperCard style={{ width: wide ? "48%" : "100%", minWidth: 0 }}>
    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.marigold }}><Copy kind="title" style={{ fontSize: 21, lineHeight: 26 }}>{product.name.slice(0, 1).toUpperCase()}</Copy></View>
    <View style={{ gap: 4 }}><Copy kind="title" style={{ fontSize: 24, lineHeight: 31 }}>{product.name}</Copy><Copy>{product.description || "Club merchandise"}</Copy><Copy kind="mono" style={{ fontSize: 11 }}>Standard {money(product.pricePaise)}{product.memberPricePaise === null ? "" : ` · active member ${money(product.memberPricePaise)}`}</Copy></View>
    <Copy kind="label">Choose a size</Copy>
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{product.variants.map((variant) => <VariantChoice key={variant.id} variant={variant} selected={variant.id === selected?.id} onSelect={() => { setVariantId(variant.id); if (quantity > variant.stock) setQuantity(1); }} />)}</View>
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}><Copy kind="label">Quantity</Copy>{[1, 2].map((value) => <Action key={value} disabled={!available || value > (selected?.stock ?? 0)} primary={quantity === value} onPress={() => setQuantity(value)} accessibilityLabel={`Quantity ${value}`}>{String(value)}</Action>)}</View>
    {selected && <Copy>{selected.stock === 0 ? `Size ${selected.size} is sold out.` : `${selected.stock} currently available in size ${selected.size}. Stock is rechecked when you reserve.`}</Copy>}
    <WriteNotice state={write} />
    {canReserveMerchandise(user) && <Action primary disabled={!available || quantity > (selected?.stock ?? 0) || write.busy} onPress={() => void reserve()}>{write.busy ? "Reserving…" : available ? `Reserve ${selected?.size ?? "size"}` : "Sold out"}</Action>}
  </PaperCard>;
}

function VariantChoice({ variant, selected, onSelect }: { variant: ProductVariant; selected: boolean; onSelect(): void }) {
  return <Action disabled={variant.stock === 0} primary={selected} onPress={onSelect} accessibilityLabel={`Size ${variant.size}, ${variant.stock} available`}>{variant.size} · {variant.stock}</Action>;
}

function OrderCard({ order, refresh }: { order: MerchOrder; refresh(): Promise<void> }) {
  const { client, user } = useSession();
  const write = useWrite();
  const [reference, setReference] = useState("");
  const actions = useMemo(() => orderActions(user, order), [user, order]);
  const act = (action: "confirm" | "cancel" | "fulfil") => write.run(async () => {
    try {
      await client.request(`/api/orders/${order.id}/${action}`, { method: "POST", body: JSON.stringify(action === "confirm" ? { reference: reference.trim() } : {}) });
      write.setNotice(action === "confirm" ? "Payment confirmed by the server." : action === "fulfil" ? "Order marked as handed over." : "Hold cancelled and stock released.");
    } finally { await refresh(); }
  });
  const tone = order.status === "paid" || order.status === "fulfilled" ? "good" : order.status === "pending_payment" ? "warn" : order.status === "expired" ? "bad" : "neutral";
  return <PaperCard>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}><Copy kind="title" style={{ fontSize: 22, lineHeight: 29 }}>{order.productName} · {order.size}</Copy><StatusBadge label={orderStatusLabel(order.status)} tone={tone} /></View>
    <Copy>{order.memberName} · quantity {order.quantity}</Copy><Copy kind="mono">{money(order.totalPaise)} · {order.pricing} price fixed by server</Copy>
    {order.status === "pending_payment" && order.holdExpiresAt && <Copy>Reserved until {new Date(order.holdExpiresAt).toLocaleString()}. Pay a club officer before this time.</Copy>}
    {order.status === "expired" && <Copy accessibilityRole="alert">This hold expired. Select an available size above to book again.</Copy>}
    {order.status === "paid" && <Copy>Payment has been confirmed. Waiting for collection.</Copy>}
    {order.status === "fulfilled" && order.fulfilledAt && <Copy>Handed over {new Date(order.fulfilledAt).toLocaleString()}.</Copy>}
    <WriteNotice state={write} />
    {actions.includes("confirm") && <Field label="Officer payment reference" value={reference} onChangeText={setReference} editable={!write.busy} />}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {actions.includes("confirm") && <Action primary disabled={write.busy || reference.trim().length < 3} onPress={() => void act("confirm")}>Record payment received</Action>}
      {actions.includes("fulfil") && <Action primary disabled={write.busy} onPress={() => void act("fulfil")}>Mark handed over</Action>}
      {actions.includes("cancel") && <Action disabled={write.busy} onPress={() => void act("cancel")}>Cancel hold</Action>}
    </View>
  </PaperCard>;
}
