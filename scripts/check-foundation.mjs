import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Value: protects=HTTP member persistence across process restarts;
// fails_when=server storage becomes transient or rejected writes persist;
// why_new=existing tests call handlers or reopen a DB, not the built server;
// seam=none (real Next.js server and an isolated SQLite database).
const root = fileURLToPath(new URL("../", import.meta.url));
await access(join(root, ".next", "BUILD_ID")).catch(() => {
  throw new Error("Build the app first with npm run build.");
});
const directory = await mkdtemp(join(tmpdir(), "mode-foundation-"));
const password = randomBytes(24).toString("hex");
const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
let server;
let closed;
let output = "";
let base;

async function stopServer() {
  if (!server) return;
  if (server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
  if (!(await Promise.race([closed.then(() => true), delay(5000).then(() => false)]))) {
    server.kill("SIGKILL");
    assert.ok(await Promise.race([closed.then(() => true), delay(5000).then(() => false)]), "Server must stop before cleanup");
  }
  server = undefined;
}

async function startServer() {
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${port}`;
  output = "";
  server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", SQLITE_PATH: join(directory, "mode.sqlite"), MODE_DEMO_PASSWORD: password, MODE_DEMO_NOW: "2026-10-10T08:00:00.000Z" },
  });
  let spawnError;
  server.once("error", error => { spawnError = error; });
  closed = new Promise(resolve => server.once("close", resolve));
  const capture = chunk => { output = (output + chunk.toString()).slice(-8000); };
  server.stdout.on("data", capture);
  server.stderr.on("data", capture);
  const deadline = Date.now() + 30000;
  while (!output.includes("Ready in")) {
    if (spawnError) throw spawnError;
    assert.equal(server.exitCode, null, `Server exited before readiness:\n${output}`);
    assert.ok(Date.now() < deadline, `Server startup timed out:\n${output}`);
    await delay(100, undefined, { signal: cancellation.signal });
  }
}

async function request(path, expected, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(10000)]) });
  assert.equal(response.status, expected, `${options.method ?? "GET"} ${path}`);
  return response;
}

try {
  await startServer();
  const health = await (await request("/api/health", 200)).json();
  assert.equal(health.database, "sqlite");
  assert.equal(health.status, "ok");
  assert.ok(Number.isInteger(health.schemaVersion) && health.schemaVersion > 0);
  assert.match(await (await request("/", 200)).text(), /MODE/);
  const publicDashboard = await (await request("/api/dashboard", 200)).json();
  assert.ok(publicDashboard.events.length > 0, "Dashboard reads seeded SQLite data");
  assert.deepEqual(publicDashboard.members, [], "Anonymous reads hide members");
  console.log("PASS: built page, health and SQLite-backed dashboard");

  const session = await (await request("/api/auth/login", 200, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "organizer@example.com", password }),
  })).json();
  assert.equal(typeof session.token, "string");
  const headers = { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" };
  const members = async () => (await (await request("/api/members", 200, { headers })).json()).members;
  const before = await members();
  const payload = { name: "Foundation Check", email: "foundation-check@example.com" };
  const created = await (await request("/api/members", 201, { method: "POST", headers, body: JSON.stringify(payload) })).json();
  assert.equal(created.member.email, payload.email);
  assert.equal(created.member.duesStatus, "unpaid");
  assert.equal((await members()).length, before.length + 1);
  console.log("PASS: authorized member creation");

  for (const [body, expected] of [
    [JSON.stringify({ ...payload, email: payload.email.toUpperCase() }), 409],
    [JSON.stringify({ name: "X", email: "invalid" }), 400],
    ["{broken", 400],
  ]) await request("/api/members", expected, { method: "POST", headers, body });
  assert.equal((await members()).length, before.length + 1, "Rejected submissions must not add rows");
  console.log("PASS: duplicate, invalid and malformed submissions rejected without writes");

  const publicationBody = JSON.stringify({ idempotencyKey: "restart-notice", title: "Synthetic restart notice", body: "This publication must survive a server restart." });
  const publication = await (await request("/api/announcements", 201, { method: "POST", headers, body: publicationBody })).json();
  assert.equal(publication.recipientCount, 3);
  assert.equal(publication.delivery, "simulated");
  const announcementPath = `/api/announcements/${publication.announcement.id}`;
  assert.deepEqual(await (await request(announcementPath, 200)).json(), { announcement: publication.announcement });
  const delivery = await (await request(`${announcementPath}/outbox`, 200, { headers })).json();
  assert.equal(delivery.messages.length, 3);
  assert.ok(delivery.messages.every(row => row.status === "simulated"));
  await request(`${announcementPath}/outbox`, 401);
  const memberSession = await (await request("/api/auth/login", 200, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "active@example.com", password }),
  })).json();
  const inbox = await (await request("/api/notifications", 200, { headers: { Authorization: `Bearer ${memberSession.token}` } })).json();
  assert.equal(inbox.notifications.filter(row => row.announcementId === publication.announcement.id).length, 1);
  console.log("PASS: built announcement routes publish, protect simulated outbox and notify active members");

  await stopServer();
  await startServer();
  const after = await members();
  assert.equal(after.length, before.length + 1, "Restart must not reseed or lose rows");
  assert.deepEqual(after.find(member => member.id === created.member.id), created.member);
  console.log("PASS: member and authenticated session persist across a real server restart");
  const replay = await (await request("/api/announcements", 200, { method: "POST", headers, body: publicationBody })).json();
  assert.deepEqual(replay, { ...publication, created: false });
  assert.equal((await (await request(`${announcementPath}/outbox`, 200, { headers })).json()).messages.length, 3);
  console.log("PASS: publication and recipient snapshot persist without duplicates across a real server restart");
} catch (error) {
  console.error("Foundation check failed:", error.message);
  process.exitCode = 1;
} finally {
  await stopServer();
  // directory is created by this process under the OS temp directory, never supplied by the caller.
  await rm(directory, { recursive: true, force: true });
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
