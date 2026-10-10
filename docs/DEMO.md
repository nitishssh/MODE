# Demo and release checks

## Runnable starter acceptance

Foundation acceptance was verified in [merged PR #26](https://github.com/nitishssh/MODE/pull/26). See [the foundation guide](FOUNDATION.md#acceptance-evidence) for the release commit, passing CI and browser evidence. Repeat these checks for a new release candidate.

1. Use Node 24, run `npm ci`, then `npm run dev`.
2. Open http://127.0.0.1:3000 and sign in with a synthetic account. Confirm the dashboard records load.
3. Sign in as `organizer@example.com` using `MODE_DEMO_PASSWORD` (development default `mode-demo-2026`) and create a fictional member from Members. The same flow is available through `POST /api/auth/login` and `POST /api/members` with a cookie or bearer token; see [API contracts](API.md).
4. Read `GET /api/members` with that session, restart the server, and read again: the new unpaid member remains present.
5. Submit the same email again through the authorized API: expect 409 without adding another record.
6. Check invalid name/email handling through the authorized API. Navigate all six web areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports SQLite schema version 9.
8. Run `npm run check`, then `npm run test:foundation`. The first command includes typecheck, API documentation contracts, domain/API tests and the build; the second checks HTTP member/session persistence across a server restart using a temporary database.
9. Set `MODE_DEMO_PASSWORD` before seeding a new production database, then run `npm start`. Public reads work; member creation requires an organizer/admin session. Verify missing authentication returns 401, insufficient permissions return 403, and cross-origin cookie writes return 403. Production ignores `MODE_CORS_ORIGINS`.

## Backend acceptance: foundation, dues, tickets and merchandise

Use Node 24 and a fresh, synthetic SQLite database. The following PowerShell setup freezes the club date for repeatable expiry/pricing results:

```powershell
npm ci
npm run check
$env:SQLITE_PATH = Join-Path $env:TEMP ('mode-demo-' + [guid]::NewGuid().ToString('N') + '.sqlite')
$env:MODE_DEMO_NOW = '2026-10-10T08:00:00Z'
npm run dev
```

Use an HTTP client at `http://127.0.0.1:3000`. Login with `POST /api/auth/login` and `{email,password}` using the synthetic accounts below and `MODE_DEMO_PASSWORD` (development default `mode-demo-2026`). Send the returned token as `Authorization: Bearer <token>`; never print/store it in demo evidence. For browser cookies, send the matching same-origin `Origin` header for mutations. The route inputs and permissions are in [API.md](API.md).

1. **Starter/P0 (#1/#2):** login as `organizer@example.com`. `POST /api/members` with `{name:"Acceptance Student",email:"acceptance@example.com"}` returns 201 and a member ID. Repeat the email: 409. Invalid name/email: 400. Directory access without login: 401; as `active@example.com`: 403. `GET /api/auth/me` for that active account includes its member pass. Keep separate officer/member tokens.
2. **Dues (#4):** as organizer, `POST /api/membership/dues` with `{memberId:<new ID>,reference:"DEMO-DUES-1"}` returns 201, 50000 paise and expiry `2027-10-10`. Repeat the reference: 200, `created:false`, no new income. For early renewal use `DEMO-DUES-2`; expiry becomes `2028-10-09` (365 days through a leap year). To demonstrate reminders, restart with `MODE_DEMO_NOW=2028-09-20T08:00:00Z`, log in again, inspect `/api/membership/expiring`, and run `POST /api/membership/reminders/run` twice: the second run adds no reminders. Restore the original clock before the next scenarios.
3. **Tickets (#5):** as organizer create `/api/events` with `{title:"Acceptance Gala",startsAt:"2026-11-01T13:30:00Z",venue:"Demo Hall",capacity:1,memberPricePaise:5000,guestPricePaise:10000}`. As active member, `POST /api/events/{eventId}/tickets` reserves the seat at 5000 paise. As organizer, confirm `/api/tickets/{ticketId}/confirm` with `{reference:"DEMO-TICKET"}`: 201 initially, 200 on retry. Scan `/api/events/{eventId}/scan` with `{credential:<ticket shortCode>}`: `Admitted`, then `Already checked in` with the original timestamp. Run the event test file below for the complete door table and expiry/rebooking cases.
4. **Merchandise (#6):** as organizer create `/api/products` with `{name:"Acceptance Tee",pricePaise:3000,memberPricePaise:2500,variants:[{size:"M",stock:1}]}`. As active member, `POST /api/orders` with `{variantId:<returned variant ID>}` fixes the price at 2500 and reserves the unit. Confirm `/api/orders/{orderId}/confirm` as organizer with `{reference:"DEMO-ORDER"}`: 201, then 200 on retry. `POST /api/orders/{orderId}/fulfil` marks it fulfilled. Inspect products: M stock remains zero.
5. **Persistence/ledger:** restart with the same `SQLITE_PATH`; member/expiry, ticket check-in and paid order remain. As `lead@example.com` or `treasurer@example.com`, inspect `/api/ledger/entries` and `/api/ledger/summary`. Each payment reference appears once. With one dues payment, the ticket and the order above, the opening 185000 paise becomes 242500; add 50000 if you also ran the early renewal. Logout revokes the selected session.

Focused automated acceptance (including true simultaneous reservations) runs with:

```text
node --import tsx --test tests/p0-foundations.test.ts tests/membership-state.regression-1.test.ts tests/membership-dues.test.ts tests/event-tickets.test.ts tests/merchandise.test.ts tests/ledger-reconciliation.test.ts tests/ledger.regression-1.test.ts tests/reservations.regression-1.test.ts
```

See [acceptance evidence](ACCEPTANCE.md) for observed outcomes and the reconciliation repair. These are backend checks; native camera/Expo and the complete semester journey remain separate delivery issues.

## Full MVP acceptance — integration and remaining tickets

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

## Treasury export and event reports

1. Sign in as treasurer@example.com after recording an external reimbursement. Open Treasury and compare the paid expense, payment reference and remaining balance.
2. Open `/api/ledger/export` in the same authenticated browser. Save the CSV and check that each confirmed payment has one row. Submitted, rejected and approved-but-unpaid expenses must not reduce the ledger balance. Text beginning with spreadsheet formula characters is escaped.
3. As an organizer or administrator, request `GET /api/events/{id}/report` for an event in the same club. Replace `{id}` with its actual ID. Compare ticket counts and realized revenue with confirmed bookings, and compare the added task counts with the task board. Fundraiser income comes from the same event-attributed ledger.
4. Repeat the export without signing in and expect 401. A signed-in ordinary member receives 403. Reports for another club are unavailable.

For LAN setup and home-screen limitations, follow [the README](../README.md#lan-and-home-screen-access). This walkthrough describes checks to perform; it is not a claim that hosted or physical-device checks have passed.

## Expo shell and same-origin web

From the repository root, install both packages and stage the web export:

```sh
npm ci
npm ci --prefix client
npm run check:client-contracts
npm --prefix client run typecheck
npm --prefix client run lint
npm --prefix client test
npm run build:client
```

In PowerShell, set `$env:MODE_EXPO_WEB='1'` and `$env:MODE_DEMO_PASSWORD='your-private-demo-password'`, then run `npm run build` and `npm start`. POSIX shells use `export MODE_EXPO_WEB=1` and `export MODE_DEMO_PASSWORD=your-private-demo-password`. Both build and start need the flag. Open `http://127.0.0.1:3000`; `/api` remains on this same origin, `/t/{token}` remains the guest ticket page, and `/legacy` retains the existing workflow UI. Without the flag, `/` remains the original workspace. Enabling the flag without a staged export fails with a setup message.

1. Sign in as `lead@example.com` using the configured password. Open Tasks, update a task, refresh and confirm the saved status. Treasury should be visible.
2. Sign out, then sign in as `active@example.com`. Treasury must be absent; a direct `/treasury` visit must not expose its data. Ordinary members can update only tasks assigned to them.
3. Refresh `/tasks` and `/pass` directly. Confirm cookie restoration, honest loading/error states, and timestamps after refresh. Test both phone-width bottom tabs and a wide left navigation.
4. Open `/legacy` and verify the current task/receipt/expense workflows remain available. The new shell is not evidence that the scanner, pending holds or full native treasury flows are finished.
5. Run `npm run test:expo-web` after the Expo-enabled Next build. It starts its own temporary server/database and checks deep links, assets, guest/API exclusions, PWA icons and cookie login/logout.
6. For Android/iOS, set `client/.env` as described in `client/README.md`, run the backend on LAN and start Expo. Verify login, app restart, assigned-task actions, role navigation, session expiry and logout on each actual target. `npx expo export --platform android --platform ios --output-dir dist-native` checks bundle compilation only.
7. For Windows installation, serve via HTTPS or localhost and install using Edge/Chrome's app menu. Confirm the installed window opens, signs in and survives a restart. LAN HTTP alone does not establish PWA installation acceptance. Authenticated API data is not cached for offline use.

Local automated checks and web-browser checks are recorded in the implementation review. Physical Expo Go and installed Windows PWA checks remain pending until performed on those devices. Do not close #10 on scaffold/build evidence alone.
