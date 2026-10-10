# Demo and release checks

## Platform delivery procedure

This repository currently ships a Next.js web application, not an Expo Router application. The following procedure supports a browser or a phone browser on the same Wi-Fi network using synthetic data only.

1. Install Node 24 and run `npm ci`.
2. Copy `.env.example` to `.env.local` only if configuration is needed. Keep `MODE_CORS_ORIGINS` empty unless a separate browser origin must call the API. Do not put passwords, tokens, or real IP addresses in committed files.
3. Start the local-only server with `npm run dev`, or start the LAN demo with `npm run dev:lan`. For a production-mode LAN demo, run `npm run build` then `npm run start:lan`.
4. On Windows, use `ipconfig` and identify the active Wi-Fi adapter's IPv4 address. From a phone on the same Wi-Fi, open `http://<wifi-ip>:3000`. `<wifi-ip>` is a placeholder, not a configured project address.
5. Check `http://<wifi-ip>:3000/api/health`. A 200 SQLite response proves backend reachability only; it does not prove authentication.
6. Exercise the supported synthetic member, task, expense, receipt, and treasury flows. Production writes require the explicit trusted-demo setting described in `.env.example`.
7. For PWA installation, serve the site over HTTPS (or use localhost), open `/manifest.webmanifest` to confirm it loads, then use Microsoft Edge's **Apps → Install this site as an app**. No service worker is installed, by design, so sensitive API data is not cached.
8. Run `npm run check` before a release demonstration.

### Expo Go, sign-in, and ticket check-in: blocked

There is no Expo SDK, Expo Router app, authentication contract, ticket API, or ticket check-in screen in MODE. Therefore Android/iOS Expo Go opening, sign-in, typed ticket-code check-in, and native token verification are **NOT TESTED / BLOCKED by missing implementation**, rather than simulated. A future Expo client must set `EXPO_PUBLIC_API_URL` to an absolute LAN-reachable origin such as `http://<wifi-ip>:3000`, never `localhost`, and use the future backend's explicit native authentication contract.

### LAN troubleshooting

- Confirm both devices are on the same non-isolated Wi-Fi network; guest networks often block peer traffic.
- Permit Node.js through Windows Defender Firewall on private networks and verify that port `3000` is not already occupied.
- A physical phone cannot use `127.0.0.1` or `localhost` to reach the development computer.
- HTTP LAN URLs will not satisfy browser PWA installability. Use a trusted HTTPS deployment for installation testing.
- CORS only applies to browser requests from a different origin. Add the exact origin to `MODE_CORS_ORIGINS`; never use `*` with credentials.

### Hosting and persistence status

No hosted URL, cloud credentials, or persistent deployment volume are configured in this repository. Hosted verification, restart-persistence verification, backup/restore, and rollback execution are **NOT TESTED**. If a hosted URL becomes mandatory, use one writable Node.js instance with a durable volume mounted for `.data`, set `SQLITE_PATH` and receipt storage on that volume, run the health check after deployment, create only synthetic records and receipts, restart once, then verify both remain available. Static-only and ephemeral/serverless filesystems are not compatible with MODE's SQLite and receipt storage.

## Runnable starter acceptance

1. Use Node 24, run `npm ci`, then `npm run dev`.
2. Open http://127.0.0.1:3000. Confirm the fictional-data notice and dashboard records load.
3. Log in as the synthetic organizer through `POST /api/auth/login`, then create a fictional name/email through `POST /api/members` using its cookie or bearer token; see [API contracts](API.md). The starter web UI has no sign-in flow yet.
4. Read `GET /api/members` with that session, restart the server, and read again: the new unpaid member remains present.
5. Submit the same email again through the authorized API: expect 409 without adding another record.
6. Check invalid name/email handling through the authorized API. Navigate all six web areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports SQLite schema version 3.
8. Run `npm run typecheck`, `npm test`, `npm run build`.
9. Set `MODE_DEMO_PASSWORD` before seeding a new production database, then run `npm start`. Public reads work; member creation requires an organizer/admin session. Verify missing authentication returns 401, insufficient permissions return 403, and cross-origin cookie writes return 403. Production ignores `MODE_CORS_ORIGINS`.

## Full MVP acceptance — future tickets

- Member joins and pays/records dues; active status and expiry are visible.
- Member receives the correct event price; guest price differs; the final seat cannot be sold twice.
- Ticket checks in once; invalid and repeated scans are rejected with clear feedback.
- Announcement appears on the website with a dated archive and inspectable delivery/outbox state.
- Hoodie order chooses a size, confirms payment state and updates stock exactly once.
- Organizer assigns a fundraiser task; volunteer can update its status.
- Volunteer submits expense evidence; treasurer approves and records reimbursement payment.
- Treasurer sees income, expenses and remaining balance matching the source transactions.
- Authorization, refresh/restart persistence, error states and mobile usability pass.

## Nitish's platform/release checklist

- Confirm all primary owners have merged and can explain their own work.
- Check CI, persistent storage, environment configuration, health endpoint and logs.
- Keep a verified local demo as fallback; document release commit, backup and rollback.
- Review README for implemented versus simulated behavior.
- Verify evaluator access, code deadline and video instructions in the event portal.
- Prepare the demo recording and submission links against the verified release commit.

Target coding completion: 11 October 2026 at 10:00 AM IST. Confirm the organizer's current submission instructions before release.
