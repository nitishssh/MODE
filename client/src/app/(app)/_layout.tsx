import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../lib/session';
import { Action, ErrorNotice, LoadingRows, Screen } from '../../components/ui';
import AppTabs from '../../components/app-tabs';
export default function AuthenticatedLayout() {
  const { status, client, user, error } = useSession();
  if (status === 'loading') return <Screen title="Opening your register"><LoadingRows /></Screen>;
  if (status === 'unavailable') return <Unavailable />;
  if (!user) return <Redirect href="/login" />;
  return <View style={{ flex: 1 }}><ErrorNotice error={error} /><AppTabs key={`${user.clubId}:${user.id}`} /></View>;
  function Unavailable() { return <Screen title="Connection needed"><ErrorNotice error={client.snapshot().error} /><Action onPress={() => void client.bootstrap()}>Try again</Action></Screen>; }
}
