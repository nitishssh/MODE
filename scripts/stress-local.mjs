// Real HTTP production stress test. Only a server spawned here is targeted.
// Run: npm run build && node scripts/stress-local.mjs
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
assert.ok(readFileSync(join(root, '.next/BUILD_ID'), 'utf8').trim(), 'Build first');
mkdirSync(join(root, '.data'), { recursive: true });
const directory = mkdtempSync(join(root, '.data/stress-'));
const output = resolve(process.env.STRESS_OUTPUT ?? 'docs/performance/local-stress-results.json');
mkdirSync(resolve(output, '..'), { recursive: true });
const password = randomBytes(24).toString('hex');
const telemetryPath = join(directory, 'telemetry.jsonl');
writeFileSync(telemetryPath, '');
const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', SQLITE_PATH: join(directory, 'mode.sqlite'), MODE_SEED: 'demo', MODE_DEMO_PASSWORD: password, MODE_DEMO_NOW: '2026-10-11T06:00:00Z', MODE_EXPO_WEB: '0' };
delete env.NODE_OPTIONS;
const seedBundle = join(directory, 'seed.cjs');
// In-process TypeScript transpilation avoids tsx IPC/userInfo and compiler subprocesses.
writeFileSync(seedBundle, `const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(output, filename);
};
require(${JSON.stringify(join(root, 'scripts/stress-seed.ts'))});\n`);
function seed(grow = false) {
  return JSON.parse(execFileSync(process.execPath, [seedBundle], { cwd: root, env: { ...env, STRESS_MEMBERS: grow ? '10000' : '1000', STRESS_GROW_ONLY: grow ? '1' : '0' }, windowsHide: true, encoding: 'utf8' }).trim());
}
const fixture = seed();
const metadata = { timestamp: new Date().toISOString(), node: process.version, next: JSON.parse(readFileSync('node_modules/next/package.json')).version, platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryGiB: os.totalmem() / 2 ** 30, freeMemoryGiB: os.freemem() / 2 ** 30, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirtyWorktree: true, fixture, buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), timeoutMs: 5000, openLoopMaxInFlight: 512 };
const results = { metadata, stages: [], correctness: null };
let server, base, token, taskId, serverLog = '', sequence = 0;
const agent = new http.Agent({ keepAlive: true, maxSockets: 512, maxFreeSockets: 512 });
const pct = (xs, p) => xs.length ? xs.toSorted((a,b) => a-b)[Math.min(xs.length-1, Math.ceil(xs.length * p) - 1)] : 0;
const round = x => Math.round(x * 100) / 100;
function save() { writeFileSync(output, JSON.stringify(results, null, 2) + '\n'); }
function request(path, { method = 'GET', body, auth = true } = {}) {
  return new Promise(resolveRequest => {
    const started = performance.now();
    const data = body === undefined ? undefined : JSON.stringify(body);
    const headers = { ...(auth && token ? { authorization: `Bearer ${token}`, cookie: `mode_session=${token}` } : {}), ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}) };
    let done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolveRequest({ ...value, ms: performance.now() - started }); };
    const req = http.request(base + path, { agent, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { const buffer = Buffer.concat(chunks); finish({ status: res.statusCode, bytes: buffer.length, text: buffer.toString() }); });
      res.on('error', e => finish({ status: 0, error: e.code ?? e.message, bytes: 0 }));
    });
    const timer = setTimeout(() => req.destroy(new Error('deadline')), 5000);
    req.on('error', e => finish({ status: 0, error: e.message, bytes: 0 }));
    req.end(data);
  });
}
async function start() {
  const socket = net.createServer();
  await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port;
  await new Promise(r => socket.close(r));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['--require', join(root, 'scripts/stress-telemetry.cjs'), join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env: { ...env, STRESS_TELEMETRY: telemetryPath }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', c => { serverLog += c; });
  server.stderr.on('data', c => { serverLog += c; });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    if ((await request('/api/health', { auth: false })).status === 200) break;
    await delay(200);
  }
  const login = await request('/api/auth/login', { method: 'POST', auth: false, body: { email: 'lead@example.com', password } });
  assert.equal(login.status, 200, login.text);
  token = JSON.parse(login.text).token;
  const tasks = JSON.parse((await request('/api/tasks')).text);
  taskId = tasks[0].id;
  for (const path of ['/api/health', '/api/dashboard', '/api/events', '/api/tasks', '/']) assert.equal((await request(path)).status, 200, path);
}
async function stop() {
  agent.destroy();
  if (server && server.exitCode === null) {
    const closed = new Promise(r => server.once('close', r));
    server.kill();
    await Promise.race([closed, delay(5000)]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  writeFileSync(join(directory, 'server.log'), serverLog);
}
const actions = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),
  summary: () => request('/api/workspace/summary'),
  page: () => request('/'),
  login: () => request('/api/auth/login', { method: 'POST', auth: false, body: { email: 'lead@example.com', password } }),
  mixed: () => {
    const n = sequence++ % 10;
    if (n < 4) return request('/api/dashboard');
    if (n < 6) return request('/api/events');
    if (n < 8) return request('/api/tasks');
    return request(`/api/tasks/${taskId}/status`, { method: 'POST', body: { status: sequence % 2 ? 'todo' : 'done' } });
  },
  loginMixed: () => sequence++ % 10 === 0 ? actions.login() : request('/api/dashboard'),
};
async function stage(workload, { concurrency, rate, seconds = 15, label = workload } = {}) {
  const latencies = [], wire = [], scheduling = [], errors = {}, statuses = {};
  let count = 0, success = 0, bytes = 0, dropped = 0, inFlight = 0, peakInFlight = 0, completedInWindow = 0;
  const startedWall = Date.now(), started = performance.now(), deadline = started + seconds * 1000, clientCPU = process.cpuUsage();
  const promises = new Set();
  async function one(scheduled = performance.now()) {
    inFlight++; peakInFlight = Math.max(peakInFlight, inFlight);
    scheduling.push(performance.now() - scheduled);
    const response = await actions[workload]();
    const completed = performance.now();
    latencies.push(completed - scheduled); wire.push(response.ms);
    count++; bytes += response.bytes;
    statuses[response.status] = (statuses[response.status] ?? 0) + 1;
    if (response.status === 200 || response.status === 201) { success++; if (completed <= deadline) completedInWindow++; }
    else { const key = response.error ?? String(response.status); errors[key] = (errors[key] ?? 0) + 1; }
    inFlight--;
  }
  if (rate) {
    const total = Math.floor(seconds * rate);
    let sent = 0;
    while (sent < total) {
      const now = performance.now();
      const due = Math.min(total, Math.floor((now - started) * rate / 1000) + 1);
      while (sent < due) {
        const scheduled = started + sent++ * 1000 / rate;
        if (inFlight >= 512 || now > deadline) { dropped++; continue; }
        const p = one(scheduled); promises.add(p); p.finally(() => promises.delete(p));
      }
      if (sent < total) await delay(Math.max(1, Math.min(5, started + sent * 1000 / rate - performance.now())));
    }
    await Promise.all(promises);
  } else {
    await Promise.all(Array.from({ length: concurrency }, async () => { while (performance.now() < deadline) await one(); }));
  }
  const endedWall = Date.now(), elapsed = (performance.now() - started) / 1000;
  const clientUsage = process.cpuUsage(clientCPU);
  const telemetry = readFileSync(telemetryPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(t => t.time >= startedWall && t.time <= endedWall);
  const failurePct = 100 * (count - success + dropped) / Math.max(1, count + dropped);
  const row = { label, workload, concurrency: concurrency ?? null, offeredRps: rate ?? null, durationSeconds: seconds, elapsedIncludingDrainSeconds: round(elapsed), requests: count, success, dropped, statuses, errors, successfulRps: round(success / elapsed), successfulRpm: round(success * 60 / elapsed), completedInWindowRps: round(completedInWindow / seconds), failurePct: round(failurePct), p50Ms: round(pct(latencies, .50)), p95Ms: round(pct(latencies, .95)), p99Ms: round(pct(latencies, .99)), maxMs: round(Math.max(0, ...latencies)), wireP95Ms: round(pct(wire, .95)), schedulerP95Ms: round(pct(scheduling, .95)), peakInFlight, meanBytes: Math.round(bytes / Math.max(count, 1)), serverCPUOneCoreMeanPct: round(telemetry.reduce((s,t) => s+t.cpuOneCorePct,0) / Math.max(telemetry.length,1)), serverRSSMaxMiB: round(Math.max(0,...telemetry.map(t => t.rssMiB))), serverEventLoopP95WorstMs: round(Math.max(0,...telemetry.map(t => t.eventLoopP95Ms))), serverEventLoopMaxMs: round(Math.max(0,...telemetry.map(t => t.eventLoopMaxMs))), clientCPUOneCorePct: round((clientUsage.user+clientUsage.system)/(elapsed*10000)), sloPass: failurePct < 1 && pct(latencies,.95) < 500 };
  results.stages.push(row); save();
  console.log(JSON.stringify(row));
  await delay(500);
  return row;
}
async function correctness() {
  const freeEventResponse = await request('/api/events', { method: 'POST', body: { title: 'Stress free capacity', startsAt: '2026-12-01T10:00:00Z', venue: 'Test', capacity: 20, memberPricePaise: 0, guestPricePaise: 0 } });
  assert.equal(freeEventResponse.status, 201, freeEventResponse.text);
  const freeEventId = JSON.parse(freeEventResponse.text).event.id;
  const freeBookings = await Promise.all(Array.from({ length: 100 }, (_,i) => request(`/api/events/${freeEventId}/guest-tickets`, { method: 'POST', auth: false, body: { name: `Free Guest ${i}`, email: `free-burst-${i}@example.invalid` } })));
  assert.equal(freeBookings.filter(x => x.status === 201).length, 20);
  assert.equal(freeBookings.filter(x => x.status === 409).length, 80);
  const created = await request('/api/events', { method: 'POST', body: { title: 'Stress limited seats', startsAt: '2026-12-01T10:00:00Z', venue: 'Test', capacity: 20, memberPricePaise: 10000, guestPricePaise: 15000 } });
  assert.equal(created.status, 201, created.text);
  const eventId = JSON.parse(created.text).event.id;
  const bookings = await Promise.all(Array.from({ length: 100 }, (_,i) => request(`/api/events/${eventId}/guest-tickets`, { method: 'POST', auth: false, body: { name: `Guest ${i}`, email: `burst-${i}@example.invalid` } })));
  // Guest anti-hoarding intentionally caps pending seats at max(3, ceil(capacity/10)).
  const accepted = bookings.filter(x => x.status === 201);
  assert.equal(accepted.length, 3);
  assert.ok(bookings.every(x => x.status === 201 || x.status === 409));
  const ticketId = JSON.parse(accepted[0].text).ticket.id;
  const confirmations = await Promise.all(Array.from({ length: 50 }, () => request(`/api/tickets/${ticketId}/confirm`, { method: 'POST', body: { reference: 'stress-once-only' } })));
  assert.equal(confirmations.filter(x => x.status === 201).length, 1);
  assert.equal(confirmations.filter(x => x.status === 200).length, 49);
  const sql = new DatabaseSync(env.SQLITE_PATH);
  const inventory = sql.prepare('SELECT capacity, registered FROM events WHERE id = ?').get(eventId);
  const ledger = sql.prepare('SELECT count(*) AS n, sum(amount_paise) AS amount FROM transactions WHERE source_id = ?').get(ticketId);
  const integrity = sql.prepare('PRAGMA integrity_check').all();
  const foreignKeys = sql.prepare('PRAGMA foreign_key_check').all();
  sql.close();
  assert.equal(inventory.registered, 3); assert.equal(ledger.n, 1); assert.equal(ledger.amount, 15000);
  assert.deepEqual(foreignKeys, []);
  results.correctness = { freeSeatBurst: { requests: 100, capacity: 20, accepted: 20, soldOut: 80 }, guestBurst: { requests: 100, accepted: 3, expectedConflicts: 97, inventory }, confirmationBurst: { requests: 50, created: 1, idempotent: 49, ledger }, integrity, foreignKeys };
  save();
}
try {
  console.log(JSON.stringify(metadata));
  await start();
  if (process.env.STRESS_PROFILE === 'correctness') {
    await correctness();
    results.finishedAt = new Date().toISOString(); save();
  } else if (process.env.STRESS_PROFILE === 'summary') {
    await stage('dashboard', { concurrency: 8, label: 'dashboard-1000-members-control' });
    for (const concurrency of [1, 8, 32, 128]) await stage('summary', { concurrency, label: `summary-1000-members-c${concurrency}` });
    await stop();
    results.metadata.largeFixture = seed(true);
    await start();
    for (const concurrency of [8, 32]) await stage('summary', { concurrency, label: `summary-10000-members-c${concurrency}` });
    results.finishedAt = new Date().toISOString(); save();
  } else {
  await stage('health', { concurrency: 32 });
  for (const concurrency of [1, 8, 32, 128]) await stage('dashboard', { concurrency });
  for (const concurrency of [1, 8, 32, 128, 256]) await stage('mixed', { concurrency });
  const peak = Math.max(...results.stages.filter(x => x.workload === 'mixed').map(x => x.successfulRps));
  for (const fraction of [.5, .75, 1, 1.5]) await stage('mixed', { rate: Math.max(1, Math.floor(peak * fraction)), seconds: 30, label: `mixed-open-${fraction}` });
  await stage('mixed', { rate: Math.max(1, Math.floor(peak * .65)), seconds: 60, label: 'mixed-sustained-65pct' });
  for (const concurrency of [1, 16, 64]) await stage('page', { concurrency });
  for (const concurrency of [1, 8, 32]) await stage('login', { concurrency });
  await stage('loginMixed', { concurrency: 32, seconds: 30 });
  await stage('mixed', { concurrency: 1, seconds: 15, label: 'recovery' });
  await correctness();
  await stop();
  results.metadata.largeFixture = seed(true);
  await start();
  for (const concurrency of [1, 8, 32]) await stage('dashboard', { concurrency, label: 'dashboard-10000-members' });
  const sql = new DatabaseSync(env.SQLITE_PATH);
  results.finalDatabase = { integrity: sql.prepare('PRAGMA integrity_check').all(), foreignKeys: sql.prepare('PRAGMA foreign_key_check').all(), members: sql.prepare('SELECT count(*) AS n FROM members').get().n, auditRows: sql.prepare('SELECT count(*) AS n FROM audit_events').get().n, sessions: sql.prepare('SELECT count(*) AS n FROM sessions').get().n, journalMode: sql.prepare('PRAGMA journal_mode').get(), synchronous: sql.prepare('PRAGMA synchronous').get(), fileMiB: statSync(env.SQLITE_PATH).size / 1048576 };
  sql.close();
  results.finishedAt = new Date().toISOString(); save();
  }
} finally { await stop(); save(); }
