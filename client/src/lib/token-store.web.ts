import type { TokenStore } from './session-client';
// Web never reads or writes a response token, including to memory/browser storage.
export const tokenStore: TokenStore = {
  read: async () => null,
  write: async () => { throw new Error('Web sessions use HttpOnly cookies.'); },
  clear: async () => {},
};
