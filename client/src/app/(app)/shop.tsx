import { ProductCreate } from '../../components/setup-forms';
import { useState } from 'react';
import type { MerchOrder, ProductDetails } from '../../generated/contracts';
import { useResource } from '../../lib/use-resource';
import { useSession } from '../../lib/session';
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, Row, Screen, money } from '../../components/ui';
import { Field, useWrite, WriteNotice } from '../../components/forms';

export default function Shop() {
  const { user } = useSession();
  const products = useResource<{ products: ProductDetails[] }>('/api/products');
  const orders = useResource<{ orders: MerchOrder[] }>(user?.permissions.some(p => p === 'payments:confirm' || p === 'orders:fulfil') ? '/api/orders' : '/api/orders/mine');
  const refresh = async () => { await Promise.all([products.reload(), orders.reload()]); };
  return <Screen title="Club merchandise">{user?.permissions.includes('products:write') && <ProductCreate refresh={refresh} />}<Copy>Choose a size to reserve one unit for 30 minutes. The server fixes your eligible price when you order. Pay a club officer; no online payment is charged.</Copy><AsOf time={products.time} refreshing={products.loading} /><ErrorNotice error={products.error ?? orders.error} /><Action onPress={() => void refresh()}>Refresh stock and orders</Action>{products.loading && !products.data && <LoadingRows />}{products.data?.products.filter(p => p.active).map(product => <Row key={product.id}><Copy kind="label">{product.name}</Copy><Copy>{product.description}</Copy><Copy kind="mono">Standard {money(product.pricePaise)}{product.memberPricePaise !== null ? ` · active member ${money(product.memberPricePaise)}` : ''}</Copy>{product.variants.map(variant => <Reserve key={variant.id} id={variant.id} size={variant.size} stock={variant.stock} refresh={refresh} />)}</Row>)}{products.data?.products.length === 0 && <Copy>No merchandise is available.</Copy>}<Copy kind="title">Order register</Copy>{orders.loading && !orders.data && <LoadingRows />}{orders.data?.orders.length === 0 && <Copy>No orders yet.</Copy>}{orders.data?.orders.map(order => <Order key={order.id} order={order} refresh={refresh} />)}</Screen>;
}
function Reserve({ id, size, stock, refresh }: { id: string; size: string; stock: number; refresh(): Promise<void> }) {
  const { client } = useSession(); const write = useWrite();
  return <Row><Copy>Size {size} · {stock} available</Copy><WriteNotice state={write} /><Action disabled={!stock || write.busy} onPress={() => void write.run(async () => { try { const result = await client.request<{ order: MerchOrder }>('/api/orders', { method: 'POST', body: JSON.stringify({ variantId: id, quantity: 1 }) }); write.setNotice(`Reserved at ${money(result.order.totalPaise)}. See your order below.`); } finally { await refresh(); } })}>{stock ? 'Reserve one' : 'Sold out'}</Action></Row>;
}
function Order({ order, refresh }: { order: MerchOrder; refresh(): Promise<void> }) {
  const { client, user } = useSession(); const write = useWrite(); const [reference, setReference] = useState('');
  const confirm = user?.permissions.includes('payments:confirm');
  const cancel = confirm || order.memberId === user?.id;
  const act = (action: string) => write.run(async () => { try { await client.request(`/api/orders/${order.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'confirm' ? { reference } : {}) }); } finally { await refresh(); } });
  return <Row><Copy kind="label">{order.productName} · {order.size} × {order.quantity}</Copy><Copy>{order.memberName} · {order.status}</Copy><Copy kind="mono">{money(order.totalPaise)} · {order.pricing} price</Copy>{order.holdExpiresAt && order.status === 'pending_payment' && <Copy>Hold until {new Date(order.holdExpiresAt).toLocaleString()}</Copy>}{order.status === 'expired' && <Copy>Hold expired. Reserve again from available stock.</Copy>}<WriteNotice state={write} />{order.status === 'pending_payment' && <>{confirm && <><Field label="Payment reference" value={reference} onChangeText={setReference} editable={!write.busy} /><Action disabled={write.busy || reference.trim().length < 3} onPress={() => void act('confirm')}>Record payment received</Action></>}{cancel && <Action disabled={write.busy} onPress={() => void act('cancel')}>Cancel hold</Action>}</>}{order.status === 'paid' && user?.permissions.includes('orders:fulfil') && <Action disabled={write.busy} onPress={() => void act('fulfil')}>Mark handed over</Action>}</Row>;
}
