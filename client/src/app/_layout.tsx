import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { AnekLatin_400Regular } from '@expo-google-fonts/anek-latin/400Regular';
import { AnekLatin_600SemiBold } from '@expo-google-fonts/anek-latin/600SemiBold';
import { AnekDevanagari_400Regular } from '@expo-google-fonts/anek-devanagari/400Regular';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../lib/session';
import { Copy, LoadingRows, Screen } from '../components/ui';
export { ErrorBoundary } from 'expo-router';
export default function RootLayout() {
  const [loaded, error] = useFonts({ Literata_500Medium, AnekLatin_400Regular, AnekLatin_600SemiBold, AnekDevanagari_400Regular, JetBrainsMono_400Regular });
  return <SafeAreaProvider>{!loaded && !error ? <Screen title="Opening MODE"><LoadingRows /></Screen> : <SessionProvider>{error && <Copy accessibilityRole="alert">Fonts could not load. Using the device font.</Copy>}<Stack screenOptions={{ headerShown: false }} /></SessionProvider>}</SafeAreaProvider>;
}
