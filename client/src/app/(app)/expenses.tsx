import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { Expense, Receipt } from '../../generated/contracts';
import { usePagedList } from '../../lib/use-paged-list';
import { ListFilters, ListPageControls } from '../../components/list-pagination';
import { useSession } from '../../lib/session';
import { amountPaise } from '../../lib/journey';
import { savePrivateFile } from '../../lib/files';
import { Action, ActionGroup, Copy, LoadingRows, Row, Screen, money } from '../../components/ui';
import { Field, useWrite, WriteNotice } from '../../components/forms';

export default function Expenses() {
  const { client } = useSession(); const expenses = usePagedList<Expense>('expenses'); const write = useWrite();
  const [purpose, setPurpose] = useState(''); const [amount, setAmount] = useState('');
  const submissionId = useRef<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  async function upload() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size === undefined || asset.size <= 0 || asset.size > 5_000_000) throw new Error('Choose a nonempty JPEG, PNG or PDF receipt no larger than 5 MB.');
    const form = new FormData();
    if (Platform.OS === 'web') { if (!asset.file) throw new Error('Could not read the selected file.'); form.append('file', asset.file); }
    else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    setReceipt(await client.request<Receipt>('/api/receipts', { method: 'POST', body: form }));
  }
  return <Screen title="Expense claims"><Copy>Attach a JPEG, PNG or PDF receipt (up to 5 MB). Approval and payment are separate steps; only paid claims enter the ledger.</Copy><Row><Field label="Purpose" value={purpose} onChangeText={setPurpose} editable={!write.busy} maxLength={500} /><Field label="Amount in rupees" value={amount} onChangeText={setAmount} editable={!write.busy} keyboardType="decimal-pad" /><ActionGroup><Action disabled={write.busy} onPress={() => void write.run(upload)}>{receipt ? 'Replace receipt' : 'Choose and upload receipt'}</Action>{receipt && <Copy>Attached: {receipt.filename}</Copy>}<Action disabled={write.busy || !receipt || purpose.trim().length < 3 || !amount} onPress={() => void write.run(async () => { submissionId.current ??= randomUUID(); await client.request('/api/expenses', { method: 'POST', body: JSON.stringify({ submissionId: submissionId.current, purpose, amountPaise: amountPaise(amount), receiptId: receipt!.id }) }); submissionId.current = null; setPurpose(''); setAmount(''); setReceipt(null); write.setNotice('Claim submitted for review.'); await expenses.reload(); })}>Submit expense</Action></ActionGroup><WriteNotice state={write} /></Row>
    <ListFilters key={expenses.filterKey} kind="expenses" query={expenses.query} update={expenses.updateFilters} clear={expenses.clearFilters} />
    <ListPageControls page={expenses.data} loading={expenses.loading} error={expenses.error} time={expenses.time} cursor={expenses.query.cursor} next={expenses.next} restart={expenses.restart} reload={expenses.reload} queryError={expenses.query.error} />
    {expenses.loading && !expenses.data && <LoadingRows />}{expenses.data?.items.length === 0 && <Copy>No expense claims match this page and its filters.</Copy>}{expenses.data?.items.map(expense => <Claim key={expense.id} expense={expense} refresh={expenses.reload} />)}</Screen>;
}
function Claim({ expense, refresh }: { expense: Expense; refresh(): Promise<void> }) {
  const { client, user } = useSession(); const write = useWrite(); const [reference, setReference] = useState(''); const [note, setNote] = useState('');
  const act = (action: string) => write.run(async () => { await client.request(`/api/expenses/${expense.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'pay' ? { paymentReference: reference } : action === 'reject' ? { note } : {}) }); await refresh(); });
  return <Row><Copy kind="label">{expense.purpose}</Copy><Copy>{expense.submitterName} · {expense.status}</Copy><Copy kind="mono">{money(expense.amountPaise)}</Copy>{expense.rejectionNote && <Copy>Rejection: {expense.rejectionNote}</Copy>}{expense.paymentReference && <Copy>Paid: {expense.paymentReference}</Copy>}<WriteNotice state={write} />{expense.receiptId && <Action disabled={write.busy} onPress={() => void write.run(() => savePrivateFile(client, `/api/receipts/${expense.receiptId}`, `receipt-${expense.id}`))}>Open private receipt</Action>}{user?.permissions.includes('expenses:review') && expense.submitterId !== user.id && <>{expense.status === 'submitted' && <><Field label="Rejection note" value={note} onChangeText={setNote} editable={!write.busy} /><ActionGroup><Action disabled={write.busy} onPress={() => void act('approve')}>Approve claim</Action><Action disabled={write.busy} onPress={() => void act('reject')}>Reject claim</Action></ActionGroup></>}{expense.status === 'approved' && <><Field label="Expense payment reference" value={reference} onChangeText={setReference} editable={!write.busy} /><ActionGroup><Action disabled={write.busy || !reference.trim()} onPress={() => void act('pay')}>Record reimbursement paid</Action></ActionGroup></>}</>}</Row>;
}
