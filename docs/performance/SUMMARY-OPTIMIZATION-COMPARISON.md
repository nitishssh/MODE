# Workspace summary optimization: comparison and manual test guide

Date: 11 October 2026  
Scope: local Windows laptop, production Next.js build, SQLite, loopback HTTP.  
Raw result: [`local-summary-optimization.json`](local-summary-optimization.json)

## Executive comparison

The persistent workspace shell previously requested `/api/dashboard`, even though it only needed club identity, task progress and unread-notification counts. With 1,000 members that response was 291,653 bytes and materialized several complete collections. The shell now requests `/api/workspace/summary`, whose response is 132–133 bytes and is built from bounded SQL counts.

The closest before/after comparison is the 1,000-member, concurrency-8 stage from the same run:

| Metric | Full dashboard before | Summary after | Change |
|---|---:|---:|---:|
| Successful requests/minute | 8,286.89 | 57,281.23 | 6.91x; +591% |
| p50 latency | 55.26 ms | 7.43 ms | 86.6% lower |
| p95 latency | 74.27 ms | 13.33 ms | 82.1% lower |
| p99 latency | 84.91 ms | 24.89 ms | 70.7% lower |
| Mean response body | 291,653 bytes | 132 bytes | 99.955% smaller |
| Failed requests | 0 | 0 | unchanged |

The new endpoint results across the tested loads were:

| Fixture | Concurrency | Requests | Successful RPM | p95 | p99 | Mean body | Failures |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 members | 1 | 12,553 | 50,211.40 | 1.45 ms | 2.09 ms | 132 B | 0% |
| 1,000 members | 8 | 14,327 | 57,281.23 | 13.33 ms | 24.89 ms | 132 B | 0% |
| 1,000 members | 32 | 16,132 | 64,387.99 | 35.34 ms | 38.98 ms | 132 B | 0% |
| 1,000 members | 128 | 16,465 | 65,248.21 | 131.01 ms | 150.15 ms | 132 B | 0% |
| 10,000 members | 8 | 11,756 | 46,996.24 | 14.06 ms | 16.35 ms | 133 B | 0% |
| 10,000 members | 32 | 11,984 | 47,804.08 | 53.10 ms | 81.18 ms | 133 B | 0% |

An earlier 10,000-member dashboard run reached 1,516 RPM at concurrency 32 with p95 1,388 ms. The new summary reached 47,804 RPM and p95 53 ms. This is a cross-run comparison, while the 1,000-member concurrency-8 row above is the stronger same-run control.

## Capacity and buffer interpretation

Concurrency 32 is the efficient knee on this laptop. Raising concurrency from 32 to 128 adds only 1.3% throughput while p95 latency rises 3.7x. The observed peak is about 65,248 summary requests/minute, but it is an endpoint benchmark, not whole-system capacity.

A provisional 60–70% operating band is 39,000–45,000 summary requests/minute. That leaves about 20,000–26,000 requests/minute between the operating band and the short-run observed peak. Use this only for planning until a 10-minute or longer sustained test, mixed traffic, restart recovery and database-write contention all pass.

At 10,000 members, throughput falls roughly 17% at concurrency 8 compared with the 1,000-member fixture. The response size stays constant, showing that collection serialization has been removed; the remaining cost is count queries and database contention.

## Design tradeoffs

- The shell becomes much cheaper, while the Overview page can still request the legacy full dashboard. The result does not represent every page or the full application.
- Search waits until the user enters two characters, debounces for 180 ms, returns at most six rows and filters member results by permission. This reduces database work at the cost of not supporting single-character discovery.
- Identical overlapping client GET requests share one in-flight promise. Responses are not retained after completion, so users still receive fresh server state without cache invalidation complexity.
- The new summary remains dynamic and authenticated. No shared HTTP cache or Redis is used, avoiding cross-club data leakage while the cache-key and invalidation design is unfinished.
- SQLite performs well for this read endpoint locally, but one writable process remains the scaling boundary. PostgreSQL, rate limiting, pagination and Redis-backed ephemeral coordination remain later phases.

## Manual browser test

### 1. Start an isolated development instance

From PowerShell in the repository:

```powershell
$env:SQLITE_PATH = Join-Path $env:TEMP ('mode-summary-manual-' + [guid]::NewGuid().ToString('N') + '.sqlite')
npm run dev
```

Open `http://127.0.0.1:3000`. Sign in as `organizer@example.com` with the development demo password `mode-demo-2026`, unless `MODE_DEMO_PASSWORD` has been set to another value.

### 2. Verify shell summary behavior

1. Open browser Developer Tools, select **Network**, enable **Preserve log**, and filter for `workspace`.
2. Reload the signed-in workspace.
3. Confirm `GET /api/workspace/summary` returns `200` and a small object containing `club`, `members`, `tasks` and `unreadNotifications`.
4. Confirm the response does not contain member, task, transaction or notification arrays.
5. Navigate among Tasks, Members and Treasury. The sidebar counts and task progress should remain visible.
6. The Overview screen may independently request `/api/dashboard`; that does not mean the shell has regressed. The check is that persistent shell counts come from `/api/workspace/summary`.

Expected summary shape:

```json
{
  "club": { "name": "...", "demo": true },
  "members": 6,
  "tasks": { "total": 3, "completed": 1 },
  "unreadNotifications": 0
}
```

Counts depend on the current fixture.

### 3. Verify bounded search

1. Focus the workspace search field and type one character. No search request should be sent.
2. Type a second character. After roughly 180 ms, exactly one `/api/workspace/search?q=...` request should appear.
3. Type quickly through several characters. Intermediate keystrokes should be debounced rather than each creating a request.
4. Confirm no more than six results are shown.
5. Search for `active` as the organizer. The seeded member may appear because organizers can read members.
6. Sign out, sign in as `active@example.com`, and repeat the search. Member results must not appear for the plain member account; permitted event and task matches may still appear.
7. Search for `%` or `_` as part of a two-character query. These characters must behave literally rather than matching every SQL row.

### 4. Verify authorization directly

In a signed-out or private browser console:

```js
await fetch('/api/workspace/summary').then(async r => [r.status, await r.json()])
await fetch('/api/workspace/search?q=active').then(async r => [r.status, await r.json()])
```

Both requests should return `401`. Run the same commands in the signed-in workspace; both should return `200`, with search results capped at six.

### 5. Check response size

In the signed-in browser console:

```js
const response = await fetch('/api/workspace/summary');
const body = await response.text();
({ status: response.status, bytes: new TextEncoder().encode(body).length, body: JSON.parse(body) });
```

The exact length changes with count digits and club name. It should remain a few hundred bytes, not grow with the number of members.

## Repeat the production stress comparison

Stop the development server first. Then run:

```powershell
npm run build
$env:STRESS_PROFILE = 'summary'
$env:STRESS_OUTPUT = 'docs/performance/local-summary-rerun.json'
node scripts/stress-local.mjs
```

The script creates an isolated SQLite database, launches its own production server on a free loopback port, seeds 1,000 members, benchmarks the old dashboard and new summary, grows the fixture to 10,000 members, benchmarks again, and stops the server. It does not use the normal application database.

Review the important fields:

```powershell
$result = Get-Content docs/performance/local-summary-rerun.json -Raw | ConvertFrom-Json
$result.stages | Select-Object label,successfulRpm,p95Ms,p99Ms,meanBytes,failurePct | Format-Table -AutoSize
```

A healthy rerun should show zero failures, a summary body below 500 bytes, p95 below 500 ms and a large separation between the old dashboard and summary at concurrency 8. Absolute RPM varies with power mode, thermal state, background programs and available memory, so compare ratios as well as raw values.

## Regression checks

Run the focused and repository checks after further optimization:

```powershell
npm run typecheck
npm run check:client-contracts
npm test
npm run build
```

The focused test is `tests/workspace-chrome.test.ts`. It verifies counts, permission-scoped search, result bounds, wildcard handling, authentication and a summary response below 1 KiB.
