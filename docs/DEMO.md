# Demo and release checks

## Platform delivery procedure

This repository currently ships a Next.js web application, not an Expo Router application. The following procedure supports a browser or a phone browser on the same Wi-Fi network using synthetic data only.

1. Install Node 24 and run `npm ci`.
2. Copy `.env.example` to `.env.local` only if configuration is needed. Keep `MODE_CORS_ORIGINS` empty unless a separate browser origin must call the API. Do not put passwords, tokens, or real IP addresses in committed files.
3. Start the local-only server with `npm run dev`, or start the LAN demo with `npm run dev:lan`. For a production-mode LAN demo, set `MODE_DEMO_PASSWORD`, run `npm run build` then `npm run start:lan`.
4. On Windows, use `ipconfig` and identify the active Wi-Fi adapter's IPv4 address. From a phone on the same Wi-Fi, open `http://<wifi-ip>:3000`. `<wifi-ip>` is a placeholder, not a configured project address.
5. Check `http://<wifi-ip>:3000/api/health`. A 200 SQLite response proves backend reachability only; it does not prove authentication.
6. Exercise the supported synthetic member, task, expense, receipt, and treasury flows. Sign in with a synthetic member or officer account; the server enforces that account’s permissions.
7. For PWA installation, serve the site over HTTPS (or use localhost), open `/manifest.webmanifest` to confirm it loads, then use Microsoft Edge's **Apps → Install this site as an app**. No service worker is installed, by design, so sensitive API data is not cached.
8. Run `npm run check` before a release demonstration.

### Expo Go, native sign-in, and ticket check-in: blocked

Browser sign-in is implemented. There is no Expo SDK, Expo Router app, native authentication contract, ticket API, or ticket check-in screen in MODE. Therefore Android/iOS Expo Go opening, native sign-in, typed ticket-code check-in, and native token verification are **NOT TESTED / BLOCKED by missing implementation**, rather than simulated. A future Expo client must set `EXPO_PUBLIC_API_URL` to an absolute LAN-reachable origin such as `http://<wifi-ip>:3000`, never `localhost`, and use the future backend's explicit native authentication contract.

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
2. Open http://127.0.0.1:3000 and sign in as `lead@example.com` using `MODE_DEMO_PASSWORD` (development default `mode-demo-2026`). Confirm the dashboard loads.
3. Open Members, add a fictional name/email, and verify the new unpaid member appears.
4. Refresh and restart the server: the member remains present.
5. Submit the same email again: show a useful duplicate error without adding another record.
6. Check invalid name/email handling. Navigate all six areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports SQLite schema version 4.
8. Run `npm run typecheck`, `npm test`, `npm run build`.
9. For a production-mode demo, set `MODE_DEMO_PASSWORD`, build, and run `npm start`. Sign in; permitted same-origin writes work. Anonymous requests and unauthorized roles are rejected.

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

## Authenticated workspace walkthrough

1. Sign in as organizer@example.com. Create a task assigned to the seeded volunteer and linked to an event.
2. Sign out and sign in as volunteer@example.com. Use Assigned to me, update the task status, then submit an expense with a synthetic PDF receipt.
3. Sign out and sign in as treasurer@example.com. Approve the expense and record an external payment reference. Confirm one outflow in the ledger and the updated balance.
4. Sign in as active@example.com. The member can submit their own expenses and cannot open treasury or another member's receipt.
5. Restart with the same SQLITE_PATH. Confirm members, tasks, receipt bytes and expense states persist. Repeat a payment request with the same reference to confirm no duplicate outflow.

The default development password for these synthetic accounts is mode-demo-2026; use MODE_DEMO_PASSWORD for a private production-mode demo. The local regression suite verifies migration, authorization, persistence and payment retry behavior. A live hosted deployment and physical-device installation still require separate verification.
