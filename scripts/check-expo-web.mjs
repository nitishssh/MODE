import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { expoPagePaths } from '../shared/page-routes.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'mode-expo-check-'));
const probe = createServer().listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, DATABASE_URL: '', MODE_TEST_DATABASE_URL: '', MODE_RECEIPTS_DIR: join(directory, 'receipts'), MODE_EXPO_WEB: '1', MODE_DEMO_PASSWORD: 'mode-synthetic-check-2026', SQLITE_PATH: join(directory, 'mode.sqlite') },
});
let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${origin}/api/health`)).ok; } catch { /* server starting */ }
    if (ready) break;
    if (child.exitCode !== null) throw new Error(`Next exited: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Server did not become ready: ${output}`);
  const landing = await fetch(origin + '/');
  assert.equal(landing.status, 200);
  const landingBody = await landing.text();
  assert.match(landingBody, /class="cm-page"/);
  assert.doesNotMatch(landingBody, /id="root"/);
  for (const returnTo of ['/tasks?status=todo&q=Music+%26+arts', '//other.example', '/api/tasks', '/dashboard']) {
    const response = await fetch(origin + '/login?' + new URLSearchParams({ returnTo }));
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /Sign in to MODE/);
    assert.doesNotMatch(body, /id="root"/);
    if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) assert.match(body, /href="\/register\?returnTo=%2Fdashboard"/);
  }
  let index;
  for (const path of [...expoPagePaths, '/tasks?limit=2&status=todo&q=C%2B%2B+club', '/events?eventId=demo-event-1', '/door?eventId=demo-event-1']) {
    const response = await fetch(origin + path); assert.equal(response.status, 200, path);
    const body = await response.text(); assert.match(body, /id="root"/, path); assert.match(body, /manifest.webmanifest/, path);
    assert.match(body, /name="mode-host" content="next"/, path);
    index = body;
  }
  const script = index.match(/src="(\/_expo\/[^\"]+)"/)[1];
  const bundle = await fetch(origin + script); assert.equal(bundle.status, 200); assert.match(bundle.headers.get('content-type'), /javascript/);
  for (const path of ['/future/screen', '/members', '/api/does-not-exist', '/assets/missing.ttf', '/_expo/missing.js', '/t/not-a-ticket']) {
    const response = await fetch(origin + path); assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /id="root"/, path);
  }
  assert.doesNotMatch(await (await fetch(origin + '/legacy')).text(), /id="root"/);
  const manifest = await (await fetch(origin + '/manifest.webmanifest')).json();
  assert.equal(manifest.start_url, '/dashboard');
  for (const icon of manifest.icons) assert.equal((await fetch(origin + icon.src)).status, 200, icon.src);
  const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'lead@example.com', password: 'mode-synthetic-check-2026' }) });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie'); assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=lax/i);
  const cookie = setCookie.split(';')[0];
  const authenticatedLanding = await fetch(origin + '/', { headers: { Cookie: cookie } });
  assert.match(await authenticatedLanding.text(), /class="cm-page"/, 'landing remains public when signed in');
  const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
  assert.ok(me.user.permissions.includes('ledger:read'));
  for (const path of ['/api/health/live', '/api/health/ready']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  }
  // Verify the built API and its cookie-authenticated pagination contract.
  const taskPage = async suffix => {
    const response = await fetch(origin + '/api/v2/tasks?limit=1' + suffix, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  const first = await taskPage('');
  assert.equal(first.items.length, 1);
  assert.equal(first.hasMore, true);
  const second = await taskPage('&cursor=' + encodeURIComponent(first.nextCursor));
  assert.equal(second.items.length, 1);
  assert.notEqual(second.items[0].id, first.items[0].id);
  assert.equal((await fetch(origin + '/api/v2/tasks?limit=1&cursor=invalid', { headers: { Cookie: cookie } })).status, 400);
  const logout = await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie } }); assert.equal(logout.status, 200);
  assert.equal((await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await fetch(origin + '/api/v2/tasks', { headers: { Cookie: cookie } })).status, 401);
  console.log('Expo delivery passed: page/query URLs, assets, exclusions, PWA icons, cookie login/logout, health correlation and bounded v2 pagination. Browser interactions are a separate check.');
} finally {
  if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  rmSync(directory, { recursive: true, force: true });
}
