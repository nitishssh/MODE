import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, SessionClient, SessionChangedError } from '../src/lib/session-client';
import { canVisit } from '../src/lib/navigation';
import type { SessionUser } from '../src/generated/contracts';
const user: SessionUser = { id: 'member-1', clubId: 'club-1', name: 'Test member', email: 'member@example.com', role: 'member', permissions: [] };
const token = 'a'.repeat(43);
test('door navigation follows check-in permission rather than event reporting', () => {
  assert.equal(canVisit({ ...user, role: 'volunteer', permissions: ['tickets:check_in'] }, 'door'), true);
  assert.equal(canVisit({ ...user, role: 'treasurer', permissions: ['events:report', 'ledger:read'] }, 'door'), false);
  assert.equal(canVisit(user, 'door'), false);
  for (const name of ['events', 'shop', 'announcements', 'tasks']) assert.equal(canVisit(user, name), true);
});
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
test('web preview explains when its local server returns HTML instead of the MODE API', async () => {
  const { client } = setup('web', () => new Response('<!doctype html><title>Expo</title>', { headers: { 'Content-Type': 'text/html' } }));
  await client.bootstrap();
  assert.equal(client.snapshot().status, 'unavailable');
  assert.match(client.snapshot().error ?? '', /same-origin API/);
  assert.match(client.snapshot().error ?? '', /MODE_EXPO_WEB=1/);
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

// Value: protects=Private downloads use platform authentication and preserve binary bytes; fails_when=Download drops bearer or leaks credentials or parses bytes as JSON; why_new=Existing request tests exercise JSON only; seam=none
test('private binary downloads use native bearer or same-origin cookies and expire on 401', async () => {
  for (const platform of ['native', 'web'] as const) {
    let status = 200;
    const bytes = new Uint8Array([0, 255, 13, 10, 37, 80, 68, 70]);
    const { client, store } = setup(platform, (url, init) => {
      assert.equal(init.credentials, platform === 'native' ? 'omit' : 'same-origin');
      assert.equal(new Headers(init.headers).get('Authorization'), platform === 'native' ? `Bearer ${token}` : null);
      if (url.endsWith('/me')) return json({ user });
      assert.equal(url, `${platform === 'native' ? 'http://192.168.1.10:3000' : ''}/api/receipts/private`);
      return status === 200 ? new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } }) : json({ error: 'Denied' }, status);
    }, platform === 'native' ? token : null);
    await client.bootstrap();
    const blob = await client.download('/api/receipts/private');
    assert.equal(blob.type, 'application/pdf'); assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
    status = 403; await assert.rejects(client.download('/api/receipts/private'), (error: unknown) => error instanceof ApiError && error.status === 403);
    assert.equal(client.snapshot().status, 'signedIn');
    status = 401; await assert.rejects(client.download('/api/receipts/private'), ApiError);
    assert.equal(client.snapshot().status, 'signedOut'); assert.equal(store.value, null);
  }
});

// Value: protects=Private downloaded bytes cannot cross login identities; fails_when=Late download resolves after account replacement or clears new identity; why_new=JSON generation tests do not exercise binary download; seam=none
test('old binary success and 401 cannot cross or clear a newer login', async () => {
  const pending: ((response: Response) => void)[] = [];
  const { client } = setup('web', url => url.endsWith('/login') ? json({ user }) : new Promise(resolve => pending.push(resolve)));
  await client.signIn(user.email, 'first');
  const success = client.download('/api/receipts/old'); const failure = client.download('/api/receipts/expired');
  await client.signIn(user.email, 'second');
  pending[0](new Response('private')); pending[1](json({ error: 'Old session' }, 401));
  await assert.rejects(success, SessionChangedError); await assert.rejects(failure, ApiError);
  assert.equal(client.snapshot().status, 'signedIn');
});

// Value: protects=Lost native credentials remove cached authenticated identity; fails_when=Restore sets signedOut but keeps the old user visible; why_new=Existing restoration tests start without an authenticated user; seam=none
test('native resume clears the authenticated user when secure storage no longer has a token', async () => {
  let calls = 0;
  const { client, store } = setup('native', () => { calls++; return json({ user }); }, token);
  await client.bootstrap(); assert.equal(client.snapshot().user?.id, user.id);
  store.value = null; await client.bootstrap();
  assert.equal(client.snapshot().status, 'signedOut'); assert.equal(client.snapshot().user, null);
  assert.equal(calls, 1, 'missing credentials must not issue another authenticated request');
});

// Value: protects=Native registration stores its bearer and resume preserves mounted identity until validation; fails_when=Signup omits token storage or picker resume tears down private drafts; why_new=Login tests do not cover registration or authenticated resume; seam=none
test('native signup stores its token and authenticated resume retains identity while validation is pending', async () => {
  let resolveMe: ((response: Response) => void) | undefined;
  const { client, store } = setup('native', (url, init) => {
    if (url.endsWith('/register')) {
      assert.equal(new Headers(init.headers).get('Authorization'), null);
      assert.deepEqual(JSON.parse(String(init.body)), { name: 'New Member', email: user.email, password: 'password' });
      return json({ user, token }, 201);
    }
    assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
    return new Promise(resolve => { resolveMe = resolve; });
  });
  await client.signUp(' New Member ', ` ${user.email} `, 'password');
  assert.equal(store.value, token); assert.equal(store.writes, 1); assert.equal(client.snapshot().status, 'signedIn');
  const priorUser = client.snapshot().user; const resume = client.bootstrap();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(client.snapshot().status, 'signedIn'); assert.equal(client.snapshot().user, priorUser);
  assert.ok(resolveMe); resolveMe(json({ user })); await resume;
  assert.equal(client.snapshot().status, 'signedIn'); assert.equal(client.snapshot().user?.id, user.id);
  const offlineResume = client.bootstrap();
  await new Promise(resolve => setImmediate(resolve));
  resolveMe(json({ error: 'Temporary outage' }, 503)); await offlineResume;
  assert.equal(client.snapshot().status, 'signedIn'); assert.equal(client.snapshot().user?.id, user.id);
  assert.match(client.snapshot().error ?? '', /revalidate/);
  const revokedResume = client.bootstrap();
  await new Promise(resolve => setImmediate(resolve));
  resolveMe(json({ error: 'Revoked' }, 401)); await revokedResume;
  assert.equal(client.snapshot().status, 'signedOut'); assert.equal(client.snapshot().user, null);
});
