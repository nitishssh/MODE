import { Tabs } from "expo-router";
import { Pressable, ScrollView, useWindowDimensions } from "react-native";
import { destinations, canVisit } from "../lib/navigation";
import { useSession } from "../lib/session";
import { Copy, useTheme } from "./ui";
import { fonts } from "../constants/theme";
export default function AppTabs() {
  const { user } = useSession();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  if (!user) return null;
  return (
    <Tabs
      tabBar={({ state, navigation }) => (
        <ScrollView
          horizontal={width < 900}
          style={{
            flexGrow: 0,
            maxWidth: width >= 900 ? 180 : undefined,
            backgroundColor: theme.panel,
          }}
          contentContainerStyle={{ gap: 4, padding: 8 }}
          showsHorizontalScrollIndicator
        >
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
                  if (!event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{
                  padding: 12,
                  minHeight: 48,
                  backgroundColor:
                    state.routes[state.index].key === route.key
                      ? theme.hairline
                      : theme.panel,
                }}
              >
                <Copy kind="label">
                  {destinations.find((item) => item.name === route.name)?.label}
                </Copy>
              </Pressable>
            ))}
        </ScrollView>
      )}
      screenOptions={{
        headerShown: false,
        tabBarPosition: width >= 900 ? "left" : "bottom",
        tabBarActiveTintColor: theme.terracottaInk,
        tabBarActiveBackgroundColor: theme.hairline,
        tabBarInactiveBackgroundColor: theme.panel,
        tabBarInactiveTintColor: theme.instruction,
        tabBarLabelStyle: {
          fontFamily: fonts.strong,
          fontSize: 14,
          lineHeight: 24,
        },
        tabBarIconStyle: { display: "none" },
        tabBarItemStyle: { justifyContent: "center" },
        tabBarStyle: {
          backgroundColor: theme.panel,
          borderColor: theme.hairline,
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
