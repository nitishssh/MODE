import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from './session-client';
const key = 'mode.session.v1';
export const tokenStore: TokenStore = {
  read: () => SecureStore.getItemAsync(key),
  write: token => SecureStore.setItemAsync(key, token),
  clear: () => SecureStore.deleteItemAsync(key),
};
