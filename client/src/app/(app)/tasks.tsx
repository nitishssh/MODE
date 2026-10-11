import { TaskCreate } from '../../components/setup-forms';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { TaskDetails } from '../../generated/contracts';
import { useSession } from '../../lib/session';
import { usePagedList } from '../../lib/use-paged-list';
import { taskProgress } from '../../lib/journey';
import { ListFilters, ListPageControls } from '../../components/list-pagination';
import { message } from '../../lib/session-client';
import { Action, Copy, ErrorNotice, LoadingRows, Row, Screen, useTheme } from '../../components/ui';
const statuses = { todo: 'To do', in_progress: 'In progress', done: 'Done' } as const;
export default function Tasks() {
  const { user, client } = useSession(); const theme = useTheme();
  const page = usePagedList<TaskDetails>('tasks');
  const { data, loading, reload } = page;
  const progress = data ? taskProgress(data.items) : null;
  const pending = useRef(new Set<string>()); const [pendingIds, setPendingIds] = useState<string[]>([]); const [errors, setErrors] = useState<Record<string, string>>({});
  async function update(task: TaskDetails, status: TaskDetails['status']) {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id); setPendingIds([...pending.current]); setErrors(old => ({ ...old, [task.id]: '' }));
    try { await client.request(`/api/tasks/${encodeURIComponent(task.id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }); await reload(); }
    catch (err) { setErrors(old => ({ ...old, [task.id]: message(err) })); }
    finally { pending.current.delete(task.id); setPendingIds([...pending.current]); }
  }
  return <Screen title="Team task register">
    {user?.permissions.includes('tasks:write') && <TaskCreate refresh={reload} />}
    <ListFilters key={page.filterKey} kind="tasks" query={page.query} update={page.updateFilters} clear={page.clearFilters} />
    <ListPageControls page={data} loading={loading} error={page.error} time={page.time} cursor={page.query.cursor} next={page.next} restart={page.restart} reload={reload} queryError={page.query.error} />
    {progress && <Row><Copy kind="label">Progress on this page</Copy><Copy>{progress.done} of {progress.total} complete · {progress.overdue} overdue</Copy><Copy>These counts cover the current page and filters.</Copy></Row>}
    {loading && !data ? <LoadingRows /> : data?.items.length ? data.items.map(task => <Row key={task.id}><Copy kind="label" style={{ color: theme.ink }}>{task.title}</Copy><Copy style={{ color: theme.ink }}>{task.assignee ?? 'Unassigned'}</Copy><Copy style={{ color: task.status === 'done' ? theme.verified : task.overdue ? theme.overdue : theme.pending }}>{statuses[task.status]}{task.overdue ? ' · overdue' : ''}</Copy>{task.dueAt && <Copy kind="mono" style={{ fontSize: 12 }}>Due {new Date(task.dueAt).toLocaleString()}</Copy>}<ErrorNotice error={errors[task.id] ?? null} />{(user?.permissions.includes('tasks:write') || user?.id === task.assigneeId) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(statuses).filter(([status]) => status !== task.status).map(([status, label]) => <Action key={status} disabled={pendingIds.includes(task.id)} onPress={() => void update(task, status as TaskDetails['status'])}>{pendingIds.includes(task.id) ? 'Saving…' : `Mark ${label.toLowerCase()}`}</Action>)}</View>}</Row>) : data && <Row><Copy>No tasks match this page and its filters.</Copy><Action onPress={page.clearFilters}>Show all tasks</Action></Row>}
  </Screen>;
}
