import { Platform, Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Dashboard } from '../../generated/contracts';
import { useResource } from '../../lib/use-resource';
import { useSession } from '../../lib/session';
import { Action, AsOf, Copy, ErrorNotice, LoadingRows, Row, Screen, useTheme } from '../../components/ui';
export default function Overview() {
  const { user, client, busy, error: sessionError } = useSession(); const theme = useTheme(); const router = useRouter();
  const { data, loading, error, time, reload } = useResource<Dashboard>('/api/dashboard');
  return <Screen title={data?.club.name ?? 'Your club register'}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
      <View><Copy>{user?.name}</Copy><Copy kind="label" style={{ color: theme.instruction }}>{user?.role}</Copy></View>
      <Action disabled={busy} onPress={() => void client.signOut()}>{busy ? 'Signing out…' : 'Sign out'}</Action>
    </View>
    <ErrorNotice error={sessionError} /><AsOf time={time} refreshing={loading} /><ErrorNotice error={error} />
    {loading && !data ? <LoadingRows /> : <Action onPress={() => void reload()} disabled={loading}>Refresh register</Action>}
    {data && <>
      <Row><Copy kind="label">YOUR MEMBERSHIP</Copy><Copy>Your pass keeps your membership and door code together.</Copy><Action onPress={() => router.push('/pass')}>Open my pass</Action></Row>
      <Row><Copy kind="label">TEAM TASKS</Copy><Copy kind="mono">{data.tasks.filter(t => t.status !== 'done').length}</Copy><Copy>Open tasks in the club</Copy><Action onPress={() => router.push('/tasks')}>Open tasks</Action></Row>
      <View><Copy kind="label">LATEST ANNOUNCEMENTS</Copy>
        {data.announcements.length ? data.announcements.map(item => <Row key={item.id}><Copy kind="label">{item.title}</Copy><Copy>{item.body}</Copy><Copy kind="mono" style={{ fontSize: 11 }}>{new Date(item.publishedAt).toLocaleDateString()}</Copy></Row>) : <Row><Copy>No announcements have been published.</Copy><Action onPress={() => void reload()}>Check again</Action></Row>}
      </View>
    </>}
    {Platform.OS === 'web' && <Row><Copy>Booking, scanning and officer workflows remain available in the web workspace while their native screens are being completed.</Copy><Action onPress={() => void Linking.openURL('/legacy')}>Open web workspace</Action></Row>}
  </Screen>;
}
