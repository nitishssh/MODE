import type { LedgerSummary } from '../../generated/contracts';
import { useResource } from '../../lib/use-resource';
import { useSession } from '../../lib/session';
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, Row, Screen, money } from '../../components/ui';
export default function Treasury() { const { user } = useSession(); return user?.permissions.includes('ledger:read') ? <Register /> : <Screen title="Access unavailable"><Copy>Your account does not have permission to read the treasury.</Copy></Screen>; }
function Register() {
  const { data, error, time, loading, reload } = useResource<LedgerSummary>('/api/ledger/summary');
  return <Screen title="Treasurer’s register"><AsOf time={time} refreshing={loading} /><ErrorNotice error={error} />{loading && !data ? <LoadingRows /> : data && <>{[['IN', data.inflowPaise], ['OUT', data.outflowPaise], ['LEFT', data.balancePaise]].map(([label, value]) => <Row key={label}><Copy kind="label">{label}</Copy><Copy kind="mono" style={{ fontSize: 30, lineHeight: 44 }}>{money(Number(value))}</Copy></Row>)}<Copy>Officer-confirmed payments. Amounts are recorded in integer paise.</Copy>{data.byCategory.map(item => <Row key={item.category}><Copy>{item.category}</Copy><Copy kind="mono">{money(item.inflowPaise)} in · {money(item.outflowPaise)} out</Copy></Row>)}</>}<Action disabled={loading} onPress={() => void reload()}>Refresh totals</Action></Screen>;
}
