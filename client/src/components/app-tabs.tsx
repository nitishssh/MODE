import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { destinations, canVisit } from "../lib/navigation";
import { useSession } from "../lib/session";
import { Copy, useTheme } from "./ui";
import { fonts } from "../constants/theme";
import { preserveTabQueryHistory } from "../lib/tab-query-history";

const queryHistoryRouter: NonNullable<ComponentProps<typeof Tabs>["UNSTABLE_router"]> = original => ({
  getStateForAction: (state, action, options) => preserveTabQueryHistory(state, original.getStateForAction(state, action, options), action.type),
});
export default function AppTabs() {
  const { user } = useSession();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  if (!user) return null;
  return (
    <Tabs
      backBehavior="fullHistory"
      UNSTABLE_router={queryHistoryRouter}
      tabBar={({ state, navigation }) => (
        <ScrollView
          horizontal={width < 900}
          style={{
            flexGrow: 0,
            maxWidth: width >= 900 ? 224 : undefined,
            backgroundColor: theme.workspace,
          }}
          contentContainerStyle={{ gap: 4, padding: width >= 900 ? 16 : 8 }}
          showsHorizontalScrollIndicator={width < 900}
        >
          <View style={{ gap: 4, marginBottom: width >= 900 ? 22 : 4, paddingHorizontal: width >= 900 ? 8 : 4 }}>
            <Text style={{ color: theme.workspaceText, fontFamily: fonts.display, fontSize: width >= 900 ? 24 : 16, letterSpacing: -0.4 }}>MODE</Text>
            <Text style={{ color: theme.landingAccent, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.1 }}>CLUB REGISTER</Text>
            {width >= 900 && <Text numberOfLines={1} style={{ color: theme.workspaceMuted, fontFamily: fonts.body, fontSize: 12 }}>{user.name}</Text>}
          </View>
          {state.routes
            .filter((route) => canVisit(user, route.name))
            .map((route) => (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: state.routes[state.index].key === route.key,
                }}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!event.defaultPrevented && state.routes[state.index].key !== route.key) navigation.navigate(route.name, route.params);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 11,
                  minHeight: 48,
                  borderLeftWidth: 2,
                  borderLeftColor: state.routes[state.index].key === route.key ? theme.landingAccent : "transparent",
                  backgroundColor:
                    state.routes[state.index].key === route.key
                      ? "#FFFFFF14"
                      : "transparent",
                }}
              >
                <Copy kind="label" style={{ color: state.routes[state.index].key === route.key ? theme.workspaceText : theme.workspaceMuted }}>
                  {destinations.find((item) => item.name === route.name)?.label}
                </Copy>
              </Pressable>
            ))}
        </ScrollView>
      )}
      screenOptions={{
        headerShown: false,
        tabBarPosition: width >= 900 ? "left" : "bottom",
        tabBarActiveTintColor: theme.workspaceText,
        tabBarActiveBackgroundColor: '#FFFFFF14',
        tabBarInactiveBackgroundColor: theme.workspace,
        tabBarInactiveTintColor: theme.workspaceMuted,
        tabBarLabelStyle: {
          fontFamily: fonts.strong,
          fontSize: 14,
          lineHeight: 24,
        },
        tabBarIconStyle: { display: "none" },
        tabBarItemStyle: { justifyContent: "center" },
        tabBarStyle: {
          backgroundColor: theme.workspace,
          borderColor: theme.workspace,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        animation: "none",
      }}
    >
      {destinations.map((route) => (
        <Tabs.Protected key={route.name} guard={canVisit(user, route.name)}>
          <Tabs.Screen
            name={route.name}
            options={{ title: route.label, tabBarIcon: () => null }}
          />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
