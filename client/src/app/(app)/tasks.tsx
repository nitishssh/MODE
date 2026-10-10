import { TaskCreate } from '../../components/setup-forms';
import { TaskProgress } from '../../components/task-progress';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { TaskDetails } from '../../generated/contracts';
import { useSession } from '../../lib/session';
import { useResource } from '../../lib/use-resource';
import { message } from '../../lib/session-client';
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, Row, Screen, useTheme } from '../../components/ui';
const statuses = { todo: 'To do', in_progress: 'In progress', done: 'Done' } as const;
export default function Tasks() {
  const { user, client } = useSession(); const theme = useTheme();
  const { data, loading, time, error, reload } = useResource<TaskDetails[]>('/api/tasks');
  const pending = useRef(new Set<string>()); const [pendingIds, setPendingIds] = useState<string[]>([]); const [errors, setErrors] = useState<Record<string, string>>({});
  async function update(task: TaskDetails, status: TaskDetails['status']) {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id); setPendingIds([...pending.current]); setErrors(old => ({ ...old, [task.id]: '' }));
    try { await client.request(`/api/tasks/${encodeURIComponent(task.id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }); await reload(); }
    catch (err) { setErrors(old => ({ ...old, [task.id]: message(err) })); }
    finally { pending.current.delete(task.id); setPendingIds([...pending.current]); }
  }
  return <Screen title="Team task register">{user?.permissions.includes('tasks:write') && <TaskCreate refresh={reload} />}{data && <TaskProgress tasks={data} />}<AsOf time={time} refreshing={loading} /><ErrorNotice error={error} /><Action onPress={() => void reload()} disabled={loading}>Refresh tasks</Action>{loading && !data ? <LoadingRows /> : data?.length ? data.map(task => <Row key={task.id}><Copy kind="label">{task.title}</Copy><Copy>{task.assignee ?? 'Unassigned'}</Copy><Copy style={{ color: task.status === 'done' ? theme.verified : task.overdue ? theme.overdue : theme.pending }}>{statuses[task.status]}{task.overdue ? ' · overdue' : ''}</Copy>{task.dueAt && <Copy kind="mono" style={{ fontSize: 12 }}>Due {new Date(task.dueAt).toLocaleString()}</Copy>}<ErrorNotice error={errors[task.id] ?? null} />{(user?.permissions.includes('tasks:write') || user?.id === task.assigneeId) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(statuses).filter(([status]) => status !== task.status).map(([status, label]) => <Action key={status} disabled={pendingIds.includes(task.id)} onPress={() => void update(task, status as TaskDetails['status'])}>{pendingIds.includes(task.id) ? 'Saving…' : `Mark ${label.toLowerCase()}`}</Action>)}</View>}</Row>) : <Row><Copy>No tasks have been assigned yet. Ask a club organizer to create the first task.</Copy><Action onPress={() => void reload()}>Check for assignments</Action></Row>}</Screen>;
}
