import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { destinations, canVisit } from '../lib/navigation';
import { useSession } from '../lib/session';
import { useTheme } from './ui';
import { fonts } from '../constants/theme';
export default function AppTabs() {
  const { user } = useSession(); const theme = useTheme(); const { width } = useWindowDimensions();
  if (!user) return null;
  return <Tabs screenOptions={{ headerShown: false, tabBarPosition: width >= 900 ? 'left' : 'bottom', tabBarActiveTintColor: theme.terracottaInk, tabBarActiveBackgroundColor: theme.hairline, tabBarInactiveBackgroundColor: theme.panel, tabBarInactiveTintColor: theme.instruction, tabBarLabelStyle: { fontFamily: fonts.strong, fontSize: 14, lineHeight: 24 }, tabBarIconStyle: { display: 'none' }, tabBarItemStyle: { justifyContent: 'center' }, tabBarStyle: { backgroundColor: theme.panel, borderColor: theme.hairline, borderTopWidth: 1, elevation: 0, shadowOpacity: 0 }, animation: 'none' }}>{destinations.map(route => <Tabs.Protected key={route.name} guard={canVisit(user, route.name)}><Tabs.Screen name={route.name} options={{ title: route.label, tabBarIcon: () => null }} /></Tabs.Protected>)}</Tabs>;
}
