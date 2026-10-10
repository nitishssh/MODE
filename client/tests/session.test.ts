import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, SessionClient, SessionChangedError } from '../src/lib/session-client';
import { canVisit } from '../src/lib/navigation';
import type { SessionUser } from '../src/generated/contracts';
const user: SessionUser = { id: 'member-1', clubId: 'club-1', name: 'Test member', email: 'member@example.com', role: 'member', permissions: [] };
const token = 'a'.repeat(43);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function setup(platform: 'web' | 'native', handler: (url: string, init: RequestInit) => Response | Promise<Response>, saved: string | null = null) {
  const store = { value: saved, reads: 0, writes: 0, clears: 0,
    async read() { this.reads++; return this.value; },
    async write(value: string) { this.writes++; this.value = value; },
    async clear() { this.clears++; this.value = null; },
  };
  const client = new SessionClient({ platform, store, baseUrl: 'http://192.168.1.10:3000', fetch: async (url, init) => handler(String(url), init!) });
  return { client, store };
}
test('web restores cookies on the same origin and never reads or persists a bearer', async () => {
  const calls: string[] = [];
  const { client, store } = setup('web', (url, init) => {
    calls.push(url); assert.ok(url.startsWith('/api/')); assert.equal(init.credentials, 'same-origin');
    assert.equal(new Headers(init.headers).get('Authorization'), null);
    return json({ user, token });
  });
  await client.bootstrap(); assert.equal(client.snapshot().user?.id, user.id);
  await client.signIn(' member@example.com ', 'password');
  assert.equal(store.reads, 0); assert.equal(store.writes, 0); assert.equal(store.value, null);
  assert.deepEqual(calls, ['/api/auth/me', '/api/auth/login']);
});
test('native restores SecureStore bearer with cookies omitted, then clears on 401', async () => {
  let expired = false;
  const { client, store } = setup('native', (url, init) => {
    assert.equal(url, 'http://192.168.1.10:3000/api/auth/me'); assert.equal(init.credentials, 'omit');
    assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
    return expired ? json({ error: 'Expired' }, 401) : json({ user });
  }, token);
  await client.bootstrap(); assert.equal(client.snapshot().status, 'signedIn');
  expired = true; await assert.rejects(client.request('/api/auth/me'), ApiError);
  assert.equal(client.snapshot().status, 'signedOut'); assert.equal(store.value, null);
});
test('native login stores only the returned single session token', async () => {
  const { client, store } = setup('native', (_url, init) => {
    assert.equal(new Headers(init.headers).get('Authorization'), null);
    return json({ user, token });
  });
  await client.bootstrap(); assert.equal(client.snapshot().status, 'signedOut');
  await client.signIn(user.email, 'password');
  assert.equal(store.value, token); assert.equal(store.writes, 1); assert.equal(client.snapshot().status, 'signedIn');
});
test('403 preserves identity and logout failure stays visible until retry succeeds', async () => {
  let fail = true;
  const { client } = setup('web', url => url.endsWith('/login') ? json({ user }) : json({ error: 'Please retry' }, fail ? 403 : 200));
  await client.signIn(user.email, 'password');
  await assert.rejects(client.request('/api/ledger/summary'), ApiError);
  assert.equal(client.snapshot().user?.id, user.id);
  await client.signOut(); assert.equal(client.snapshot().status, 'signedIn'); assert.match(client.snapshot().error!, /Sign out did not complete/);
  fail = false; await client.signOut(); assert.equal(client.snapshot().status, 'signedOut');
});
test('an old 401 cannot clear a newer login, nor can old data cross identities', async () => {
  const pending: ((response: Response) => void)[] = [];
  const { client } = setup('web', url => url.endsWith('/login') ? json({ user }) : new Promise(resolve => pending.push(resolve)));
  await client.signIn(user.email, 'first');
  const oldFailure = client.request('/api/tasks'); const oldSuccess = client.request('/api/dashboard');
  await client.signIn(user.email, 'second');
  pending[0](json({ error: 'Old session expired' }, 401)); pending[1](json({ privateData: true }));
  await assert.rejects(oldFailure, ApiError); await assert.rejects(oldSuccess, SessionChangedError);
  assert.equal(client.snapshot().status, 'signedIn');
});
test('offline restoration preserves saved native token and retry restores identity', async () => {
  let offline = true;
  const { client, store } = setup('native', () => { if (offline) throw new Error('Network'); return json({ user }); }, token);
  await client.bootstrap(); assert.equal(client.snapshot().status, 'unavailable'); assert.equal(store.value, token);
  offline = false; await client.bootstrap(); assert.equal(client.snapshot().status, 'signedIn');
});
test('storage failure never publishes authenticated native UI', async () => {
  const { client, store } = setup('native', () => json({ user, token }));
  store.write = async () => { throw new Error('Secure storage unavailable'); };
  await client.signIn(user.email, 'password');
  assert.equal(client.snapshot().status, 'signedOut'); assert.equal(client.snapshot().user, null); assert.match(client.snapshot().error!, /storage/);
});
test('permissions from the server govern routes independently of role names', () => {
  assert.equal(canVisit({ ...user, role: 'admin' }, 'treasury'), false);
  assert.equal(canVisit({ ...user, permissions: ['ledger:read'] }, 'treasury'), true);
  assert.equal(canVisit(user, 'tasks'), true); assert.equal(canVisit(user, 'unknown'), false);
});
test('native API configuration rejects credential-bearing or path URLs', async () => {
  for (const baseUrl of ['http://user:secret@example.com', 'https://example.com/path', 'https://example.com?token=x', 'file:///api']) {
    const client = new SessionClient({ platform: 'native', baseUrl, store: { async read() { return null; }, async clear() {}, async write() {} }, fetch: async () => { throw new Error('Should never fetch'); } });
    await assert.rejects(client.request('/api/auth/me'), /origin without/);
  }
});

test('old logout cannot unlock or overwrite a login started after a concurrent 401', async () => {
  const pending = new Map<string, (response: Response) => void>();
  let initial = true;
  const { client } = setup('web', url => {
    if (initial) return json({ user });
    return new Promise(resolve => pending.set(url, resolve));
  });
  await client.signIn(user.email, 'first'); initial = false;
  const resource = client.request('/api/tasks'); const logout = client.signOut();
  pending.get('/api/tasks')!(json({ error: 'Expired' }, 401));
  await assert.rejects(resource, ApiError);
  const login = client.signIn(user.email, 'second');
  assert.equal(client.snapshot().busy, true);
  pending.get('/api/auth/logout')!(json({ ok: true })); await logout;
  assert.equal(client.snapshot().busy, true); assert.equal(client.snapshot().error, null);
  pending.get('/api/auth/login')!(json({ user })); await login;
  assert.equal(client.snapshot().status, 'signedIn'); assert.equal(client.snapshot().error, null);
});
