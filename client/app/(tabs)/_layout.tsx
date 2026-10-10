import { Tabs } from "expo-router";
import { useSession } from "@/src/providers/session";
export default function TabsLayout() { const { user } = useSession(); const permissions = new Set(user?.permissions ?? []); return <Tabs screenOptions={{ headerShown: false }}><Tabs.Screen name="index" options={{ title: "Events" }} /><Tabs.Screen name="pass" options={{ title: "Pass" }} />{permissions.has("payments:confirm") && <Tabs.Screen name="holds" options={{ title: "Holds" }} />}{permissions.has("tickets:check_in") && <Tabs.Screen name="door" options={{ title: "Door" }} />}</Tabs>; }
