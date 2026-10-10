import { Redirect, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../lib/session';
import { canVisit, destinations } from '../../lib/navigation';
import { Action, ErrorNotice, LoadingRows, Screen } from '../../components/ui';
import AppTabs from '../../components/app-tabs';
export default function AuthenticatedLayout() {
  const { status, client, user, error } = useSession();
  const pathname = usePathname();
  if (status === 'loading') return <Screen title="Opening your register"><LoadingRows /></Screen>;
  if (status === 'unavailable') return <Unavailable />;
  if (!user) return <Redirect href="/login" />;
  const routeName = pathname.split('/').filter(Boolean).at(-1) || 'index';
  const destination = destinations.find((item) => item.name === routeName);
  if (destination && !canVisit(user, destination.name)) return <Redirect href="/" />;
  return <View style={{ flex: 1 }}><ErrorNotice error={error} /><AppTabs key={`${user.clubId}:${user.id}`} /></View>;
  function Unavailable() { return <Screen title="Connection needed"><ErrorNotice error={client.snapshot().error} /><Action onPress={() => void client.bootstrap()}>Try again</Action></Screen>; }
}
