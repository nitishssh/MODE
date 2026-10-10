import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/src/providers/session";
export default function Index() { const { user, loading } = useSession(); return loading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View> : <Redirect href={user ? "/(tabs)" : "/login"} />; }
