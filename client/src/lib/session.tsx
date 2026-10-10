import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { SessionClient } from './session-client';
import { tokenStore } from './token-store';
const Context = createContext<SessionClient | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new SessionClient({ platform: Platform.OS === 'web' ? 'web' : 'native', baseUrl: process.env.EXPO_PUBLIC_API_URL, store: tokenStore }));
  useEffect(() => {
    void client.bootstrap();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void client.bootstrap(); });
    return () => subscription.remove();
  }, [client]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
export function useSession() {
  const client = useContext(Context);
  if (!client) throw new Error('SessionProvider is required.');
  const state = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot);
  return { client, ...state };
}
