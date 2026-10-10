import { Redirect, useRootNavigationState, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../lib/session';
import { Action, ErrorNotice, LoadingRows, Screen } from '../../components/ui';
import AppTabs from '../../components/app-tabs';
import { canVisitPath } from '../../lib/navigation';
import { authHref, returnTargetForLocation } from '../../lib/return-target';
import { ForbiddenPage } from '../../lib/auth-redirect';
import { focusedSearchParameters } from '../../lib/route-parameters';
export default function AuthenticatedLayout() {
  const { status, client, user, error } = useSession();
  const pathname = usePathname();
  const parameters = focusedSearchParameters(useRootNavigationState());
  if (status === 'loading') return <Screen title="Opening your register"><LoadingRows /></Screen>;
  if (status === 'unavailable') return <Unavailable />;
  if (!user) return <Redirect href={authHref('/login', returnTargetForLocation(pathname, parameters))} />;
  if (!canVisitPath(user, pathname)) return <ForbiddenPage />;
  return <View style={{ flex: 1 }}><ErrorNotice error={error} /><AppTabs key={`${user.clubId}:${user.id}`} /></View>;
  function Unavailable() { return <Screen title="Connection needed"><ErrorNotice error={client.snapshot().error} /><Action onPress={() => void client.bootstrap()}>Try again</Action></Screen>; }
}
