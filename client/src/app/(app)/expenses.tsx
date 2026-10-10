import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { Expense, Receipt } from '../../generated/contracts';
import { useResource } from '../../lib/use-resource';
import { useSession } from '../../lib/session';
import { amountPaise } from '../../lib/journey';
import { savePrivateFile } from '../../lib/files';
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, Row, Screen, money } from '../../components/ui';
import { Field, useWrite, WriteNotice } from '../../components/forms';

export default function Expenses() {
  const { client } = useSession(); const expenses = useResource<Expense[]>('/api/expenses'); const write = useWrite();
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
  return <Screen title="Expense claims"><Copy>Attach a JPEG, PNG or PDF receipt (up to 5 MB). Approval and payment are separate steps; only paid claims enter the ledger.</Copy><Row><Field label="Purpose" value={purpose} onChangeText={setPurpose} editable={!write.busy} maxLength={500} /><Field label="Amount in rupees" value={amount} onChangeText={setAmount} editable={!write.busy} keyboardType="decimal-pad" /><Action disabled={write.busy} onPress={() => void write.run(upload)}>{receipt ? 'Replace receipt' : 'Choose and upload receipt'}</Action>{receipt && <Copy>Attached: {receipt.filename}</Copy>}<WriteNotice state={write} /><Action disabled={write.busy || !receipt || purpose.trim().length < 3 || !amount} onPress={() => void write.run(async () => { submissionId.current ??= randomUUID(); await client.request('/api/expenses', { method: 'POST', body: JSON.stringify({ submissionId: submissionId.current, purpose, amountPaise: amountPaise(amount), receiptId: receipt!.id }) }); submissionId.current = null; setPurpose(''); setAmount(''); setReceipt(null); write.setNotice('Claim submitted for review.'); await expenses.reload(); })}>Submit expense</Action></Row><AsOf time={expenses.time} refreshing={expenses.loading} /><ErrorNotice error={expenses.error} /><Action onPress={() => void expenses.reload()}>Refresh claims</Action>{expenses.loading && !expenses.data && <LoadingRows />}{expenses.data?.length === 0 && <Copy>No expense claims yet.</Copy>}{expenses.data?.map(expense => <Claim key={expense.id} expense={expense} refresh={expenses.reload} />)}</Screen>;
}
function Claim({ expense, refresh }: { expense: Expense; refresh(): Promise<void> }) {
  const { client, user } = useSession(); const write = useWrite(); const [reference, setReference] = useState(''); const [note, setNote] = useState('');
  const act = (action: string) => write.run(async () => { await client.request(`/api/expenses/${expense.id}/${action}`, { method: 'POST', body: JSON.stringify(action === 'pay' ? { paymentReference: reference } : action === 'reject' ? { note } : {}) }); await refresh(); });
  return <Row><Copy kind="label">{expense.purpose}</Copy><Copy>{expense.submitterName} · {expense.status}</Copy><Copy kind="mono">{money(expense.amountPaise)}</Copy>{expense.rejectionNote && <Copy>Rejection: {expense.rejectionNote}</Copy>}{expense.paymentReference && <Copy>Paid: {expense.paymentReference}</Copy>}<WriteNotice state={write} />{expense.receiptId && <Action disabled={write.busy} onPress={() => void write.run(() => savePrivateFile(client, `/api/receipts/${expense.receiptId}`, `receipt-${expense.id}`))}>Open private receipt</Action>}{user?.permissions.includes('expenses:review') && expense.submitterId !== user.id && <>{expense.status === 'submitted' && <><Action disabled={write.busy} onPress={() => void act('approve')}>Approve claim</Action><Field label="Rejection note" value={note} onChangeText={setNote} editable={!write.busy} /><Action disabled={write.busy} onPress={() => void act('reject')}>Reject claim</Action></>}{expense.status === 'approved' && <><Field label="Expense payment reference" value={reference} onChangeText={setReference} editable={!write.busy} /><Action disabled={write.busy || !reference.trim()} onPress={() => void act('pay')}>Record reimbursement paid</Action></>}</>}</Row>;
}
