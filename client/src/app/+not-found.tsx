import { useRouter } from 'expo-router';
import { Action, Copy, Screen } from '../components/ui';
export default function NotFound() { const router = useRouter(); return <Screen title="Page not found"><Copy>This page is not in your club register.</Copy><Action onPress={() => router.replace('/')}>Open overview</Action></Screen>; }
