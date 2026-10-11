# Public service status

## Header artwork

The Spartan workshop banner uses the user-supplied `ChatGPT Image Oct 11, 2026,
08_43_04 AM.png`. The original remains untouched in Downloads. Optimized assets are
`public/status/spartan-banner.webp` (2172 x 400) and
`public/status/spartan-banner-mobile.webp` (1000 x 400). The desktop crop preserves
all four characters; the mobile crop focuses on the two central characters. A native
picture element selects the crop, with explicit dimensions to prevent layout shift.
These are decorative brand illustrations, independent of live service health.

`/status` and `GET /api/status` are public. Neither requires a login, session cookie,
JWT signing key or credentials. The status page is outside the authenticated `/app`
layout and remains a real Next.js route when the optional Expo web rewrite is enabled.
Landing-page navigation and both Next.js sign-in screens link to it.

## Live checks

- API means the public status handler responded; it does not imply every API works.
- Database means `getDatabase().health()` completed a query. Checks taking at least
  one second are degraded; failures are major outages. Initialization is guarded.
- Sign-in reads account/session storage and signs/verifies an in-memory probe token.
  Missing signing configuration is a genuine failed check, not a login requirement
  for the status page. No session or account is created.
- Events, memberships and merchandise perform small reads against their feature tables.
- Receipts reads metadata and writes, reads back and removes an exclusively created
  temporary file in the configured receipts directory. It never modifies real receipts.
- These are readiness probes, not complete booking, payment or login journeys.

The browser requests a fresh snapshot every ten seconds while visible, on return to the
tab and on manual refresh. Requests omit credentials, time out after ten seconds,
and do not overlap. Invalid responses, failures or snapshots older than thirty seconds
show **Status unavailable**, never a stale green result. Public responses contain
only service states, check duration, timestamps and deliberately published notices.
Database paths, errors, users and connection strings are never returned.

Probe results are shared for five seconds per server process, with concurrent callers
sharing one probe run. Async probes have a five-second deadline; synchronous database
calls still depend on the driver's timeout. Process running time and browser request
latency appear on the page. The last thirty browser observations are shown in a small
chart; they reset when the page reloads and do not claim continuous uptime.

## Running locally

Run `npm run dev`, then open `http://127.0.0.1:3000/status`. The checks use that
process's configured `.env.local`, database and receipt directory, even with an empty
club database. No sample records are needed. If the process is stopped, an already
open tab marks the checks unavailable on the next failed request (normally within
twenty seconds). Restart it on the same port and the tab recovers automatically.
A page reload while the server is stopped cannot work without independent hosting.
For a production preview, run `npm run build` then `npm run start -- --port 3011`.

The endpoint returns HTTP 200 when the snapshot is successfully retrieved, even if
a component is down. Inspect component states, rather than treating HTTP 200 as
proof of full application health. This endpoint uses real wall-clock time, not the
demo business clock. These are immediate observations, not confirmed multi-probe
outages or end-to-end feature checks.

## Publish incidents and maintenance

Edit `src/lib/status-notices.ts` and deploy through the normal reviewed release
process. The file is validated with Zod and contains only public information.
There is deliberately no unauthenticated write endpoint. An authenticated incident
management UI is not included in this first release.

Example incident (replace with real facts; do not publish this example as history):

```ts
{
  id: "database-connectivity-2026-10-11",
  title: "Intermittent database connectivity",
  services: ["database", "events"],
  impact: "partial_outage",
  updates: [
    { at: "2026-10-11T10:00:00.000Z", stage: "investigating", message: "Some event requests are failing. We are investigating." },
    { at: "2026-10-11T10:30:00.000Z", stage: "resolved", message: "Connectivity has recovered." },
  ],
}
```

Use UTC timestamps, ordered oldest first. Stages are `investigating`, `identified`,
`monitoring`, and `resolved`; impact is `degraded`, `partial_outage`, or `major_outage`.
Future incident updates are withheld until their publication time. Resolved incidents
move to history. Public text renders as escaped React text, never HTML.

Maintenance entries use `id`, `title`, `description`, `services`, `startsAt`, and
`endsAt`. Both timestamps are UTC and the end must be later than the start. An active
window changes affected service badges to maintenance, but never hides a more severe
observed outage. Resolved incidents likewise cannot turn a failed live check green.

## Scope and deployment

Historical uptime is not collected, so the page does not manufacture percentages or
90-day charts. Empty history means no published reports, not proven uptime. A future
external monitoring worker should collect durable samples, use failure/recovery
thresholds, and distinguish missing samples from successful observations.

The page currently runs on the MODE host. If the whole application goes down, new
visitors may not reach it; visitors with an already open page will see failed checks.
Independent status hosting and an external worker are required to report a complete
host outage reliably. No external monitor, subscription provider or hosting service
is configured by this change.

## Validation

Run `node --import tsx --import ./tests/setup-env.mjs --test tests/status.test.ts`,
`npm run typecheck`, and `npm run build`. Verify `/status` in a browser without
credentials, both at desktop and narrow widths. Turn off the server with the page
open and refresh: previous green checks must become unavailable. Restore the server
and refresh: checks should recover without logging in.

Initial implementation verification (11 October 2026, before feature probes): TypeScript and production build
passed. An isolated production preview returned HTTP 200 for both `/status` and
`/api/status` without credentials or a JWT signing key; the API set no cookie,
returned `no-store`, and reported API/database health while leaving five unprobed
services unknown. The test runner could not start because the Windows sandbox
blocked `os.userInfo()` (`uv_os_get_passwd` / `ENOMEM`). Elevated test execution and
browser inspection were blocked by automatic approval review's deployment-404
error. Automated behavioral tests and visual/browser interactions remain unverified.

Feature-probe verification (11 October 2026): TypeScript and production build passed.
The production server on port 3011 used the normal local configuration and all seven
readiness checks passed; no temporary probe files remained. A separate isolated
server with the signing key disabled returned sign-in `major_outage` and six other
checks operational, while both public URLs still returned HTTP 200 without cookies.
No internal signing configuration or database error appeared in the JSON. After
stopping that verification server, its endpoint no longer responded within a two-second deadline.
The `tsx` test runner still fails before execution on the sandbox's Windows
user-profile lookup; browser interaction and visual verification remain unverified.
