# Demo and release checks

## Runnable starter acceptance

Foundation acceptance was verified in [merged PR #26](https://github.com/nitishssh/MODE/pull/26). See [the foundation guide](FOUNDATION.md#acceptance-evidence) for the release commit, passing CI and browser evidence. Repeat these checks for a new release candidate.

1. Use Node 24, run `npm ci`, then `npm run dev`.
2. Open http://127.0.0.1:3000 and sign in with a synthetic account. Confirm the dashboard records load.
3. Sign in as `organizer@example.com` using `MODE_DEMO_PASSWORD` (development default `mode-demo-2026`) and create a fictional member from Members. The same flow is available through `POST /api/auth/login` and `POST /api/members` with a cookie or bearer token; see [API contracts](API.md).
4. Read `GET /api/members` with that session, restart the server, and read again: the new unpaid member remains present.
5. Submit the same email again through the authorized API: expect 409 without adding another record.
6. Check invalid name/email handling through the authorized API. Navigate all six web areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports schema version 13 (`database` is `sqlite`, or `postgres` when `DATABASE_URL` is set).
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

## Announcement publication (#8)

Start the server with a fresh synthetic database and the frozen clock shown above. Run this in a second PowerShell terminal. Session tokens stay in memory.

```powershell
$apiBase = 'http://127.0.0.1:3000'
$demoPassword = if ($env:MODE_DEMO_PASSWORD) { $env:MODE_DEMO_PASSWORD } else { 'mode-demo-2026' }
$officerSession = Invoke-RestMethod "$apiBase/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='organizer@example.com';password=$demoPassword} | ConvertTo-Json)
$officerHeaders = @{Authorization="Bearer $($officerSession.token)"}
$publicationBody = @{idempotencyKey='DEMO-ANNOUNCEMENT-1';title='Synthetic welcome notice';body='Meet at the fictional welcome desk.'} | ConvertTo-Json
$publication = Invoke-RestMethod "$apiBase/api/announcements" -Method Post -Headers $officerHeaders -ContentType 'application/json' -Body $publicationBody
$publication
Invoke-RestMethod "$apiBase/api/announcements"
Invoke-RestMethod "$apiBase/api/announcements/$($publication.announcement.id)"
Invoke-RestMethod "$apiBase/api/announcements/$($publication.announcement.id)/outbox" -Headers $officerHeaders
Invoke-RestMethod "$apiBase/api/announcements" -Method Post -Headers $officerHeaders -ContentType 'application/json' -Body $publicationBody
foreach ($email in @('active@example.com','expired@example.com','organizer@example.com')) {
  $memberSession = Invoke-RestMethod "$apiBase/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email=$email;password=$demoPassword} | ConvertTo-Json)
  $memberHeaders = @{Authorization="Bearer $($memberSession.token)"}
  $inbox = Invoke-RestMethod "$apiBase/api/notifications" -Headers $memberHeaders
  [pscustomobject]@{Account=$email;Announcements=@($inbox.notifications | Where-Object kind -eq 'announcement').Count}
}
```

On a fresh database the first publication returns `created:true`, `recipientCount:3` and `delivery:simulated`. The archive/detail contain only public content and the publication date. The outbox contains three rows labeled `simulated`. The repeat returns the same ID/date/count with `created:false`. The active account has one announcement notification; the expired and unpaid organizer accounts have none. Open the website's Announcements section to view the published notice and its detail.

Repeat after restarting with the same database: the saved key still returns the original publication. Changing the body while keeping the key returns 409. Publishing as a member, volunteer or treasurer returns 403; anonymous publishing or outbox inspection returns 401. No real email or WhatsApp is sent.

Run `node --import tsx --test tests/announcements.test.ts` for reproducible validation, role checks, IST expiry boundaries, database uniqueness, injected delivery/audit failure rollback, retry persistence, notification isolation and v10 migration coverage. After `npm run build`, `npm run test:foundation` also checks publication, protected outbox, member notifications and replay through the built HTTP server across a real restart. The Expo publishing, inbox and outbox screens are implemented; see the interactive client journey below. Full #12 acceptance still requires its remaining verification.

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

## Languages

These steps apply to the legacy web workspace at `/legacy` when the Expo export is enabled. Expo screens and the guest ticket HTML currently use English labels.

1. Open the sign-in screen and pick a language from the switcher (for example हिन्दी or தமிழ்). The page re-renders in that language without reloading data; the choice survives sign-in, navigation and a browser restart because it is stored in the `mode_lang` cookie.
2. Pick اردو: the whole workspace mirrors to right-to-left, including the sidebar and drawer, while amounts stay left-to-right with Latin digits.
3. Clear the cookie and set the browser's preferred language to Bengali: the workspace opens in বাংলা from the `Accept-Language` header. An unsupported browser language falls back to English.
4. Trigger an API error in a non-English language (for example add a member with an email that already exists): the message shown is translated from the error `code`, while `GET /api/...` responses remain English.

## Treasury export and event reports

1. Sign in as treasurer@example.com after recording an external reimbursement. Open Treasury and compare the paid expense, payment reference and remaining balance.
2. Open `/api/ledger/export.csv` in the same authenticated browser. Save the CSV and check that each confirmed payment has one row. Submitted, rejected and approved-but-unpaid expenses must not reduce the ledger balance. Text beginning with spreadsheet formula characters is escaped. Income and expense amounts are positive; subtract total expenses from income. Check the source ID and paying officer display name against the register, with blank IDs for opening balances.
3. As an organizer or administrator, request `GET /api/events/{id}/report` for an event in the same club. Replace `{id}` with its actual ID. Compare ticket counts and realized revenue with confirmed bookings, and compare the added task counts with the task board. Fundraiser income comes from the same event-attributed ledger.
4. Repeat the export without signing in and expect 401. A signed-in ordinary member receives 403. Reports for another club are unavailable.

For LAN setup and home-screen limitations, follow [the README](../README.md#lan-and-home-screen-access). This walkthrough describes checks to perform; it is not a claim that hosted or physical-device checks have passed.

## #7 receipt-to-ledger acceptance

1. On a synthetic database, sign in as active@example.com. In My Expenses, submit a JPG, PNG or PDF attachment with amount ₹123.45 and purpose “Synthetic travel receipt”. Confirm a file is required and the form says 5 MB; WebP and files above 5,000,000 bytes are rejected.
2. Sign in as treasurer@example.com, open Treasury → Expenses, and download the receipt. Approve the claim. Balance must remain unchanged and the claim must appear under Ready to pay.
3. Click Mark paid, enter SYNTHETIC-TRAVEL-1 in the inline Payment reference field, then Confirm paid. This is a simulated officer confirmation, not a money transfer. Verify exactly one ₹123.45 outflow and the new balance. A failed request leaves the reference available for retry.
4. Open Ledger, follow the expense source link and inspect its exact claim ID, purpose, paid status and reference. Download the protected receipt from the source details. Verify the Recorded by column names the paying officer.
5. Export CSV and compare all seven columns and totals with the register. Sign out and confirm export requires a session; a member account receives 403.
6. Run `npm run check`. Receipt migration tests preserve released v9 files, ownership, links and historical receiptless claims. The reconciliation harness covers paid reimbursements, failed transactions, retries and officer attribution.

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

In PowerShell, set `$env:MODE_EXPO_WEB='1'` and `$env:MODE_DEMO_PASSWORD='your-private-demo-password'`, then run `npm run build` and `npm start`. POSIX shells use `export MODE_EXPO_WEB=1` and `export MODE_DEMO_PASSWORD=your-private-demo-password`. Both build and start need the flag. Open `http://127.0.0.1:3000`; `/api` remains on this same origin, `/t/{token}` remains the guest ticket page, and `/legacy` retains the existing workflow UI.

1. Sign in as `lead@example.com`, update a task, refresh and confirm the saved status. Treasury should be visible.
2. Sign in as `active@example.com`. Treasury must be absent, direct `/treasury` navigation must return to a permitted screen, and unassigned tasks must have no status actions.
3. Refresh `/tasks` and `/pass` directly. Check the phone-width horizontally scrollable navigation bar and wide left navigation.
4. Open `/legacy` and verify the existing workflows remain available.
5. Run `npm run test:expo-web` after the Expo-enabled build. It checks deep links, assets, guest/API exclusions, PWA icons and cookie login/logout.
6. For Android/iOS, follow `client/README.md` and verify login, restart, assigned tasks, role navigation, expiry and logout on each real target.
7. For Windows, serve via HTTPS or localhost, install through Edge/Chrome and verify restart behavior.

Bundle compilation and local browser checks do not establish physical Expo Go or installed Windows PWA acceptance. Keep #10 open until those device and installed-PWA checks are complete. Business screen implementation is described below.

## Automated semester journey (#15)

Use Node 24 and run from the repository root. These commands create synthetic fixtures in unique OS temporary directories; they do not use or overwrite your normal `.data` database. The tests own and clean up their databases, receipt files and server processes.

```sh
npm ci
npx tsx --test tests/journey.test.ts
npm run check
npm run test:foundation
```

The route test registers `journey@example.com` as a new member. Its test-only credentials are local fixtures. It then exercises these transitions through real route handlers:

| Actor | Transition | Evidence asserted |
|---|---|---|
| New member / treasurer | Registration and officer-recorded dues | No paid period before dues; active membership afterward; member cannot record their own payment |
| Member / organizer / treasurer / volunteer | Event, member-price ticket, payment and check-in | Hold posts no income; payment posts once; repeat scan does not admit twice |
| Member / organizer / treasurer | Merchandise order and payment | Member discount, unpaid hold, exactly one realized income source |
| Organizer / paid member | Announcement and inbox | New member receives one notification; private outbox access denied to member; replay preserves audience |
| Organizer / volunteer | Assigned task | Non-assignee member denied; assigned volunteer can finish |
| Member / treasurer / admin | Receipt, submitted expense, approval and payment | Receipt remains private; approval posts no expense; payment and replay produce one officer-attributed ledger row |
| Expired member | Advance clock and sign in again | Old session rejected; new ticket/order use non-member prices; new publication excludes expired member; earlier audience and paid records remain intact |

After each monetary transition, the test enumerates expected source IDs and checks amounts, paying officers, source links, both reconciliation directions and the expected balance delta. Existing contract tests run with `npm run check`, including real-process last-seat/stock races, hold expiry, stale confirmation, all door outcomes, membership dates/reminders, receipt validation and announcement rollback/fan-out.

The foundation command starts a built Next.js server on an ephemeral loopback port with its own fresh database and generated password. It creates a second synthetic full journey, stops and restarts the process using the same store, and checks retained source IDs, membership, task, admission, private receipt bytes, announcement inbox/outbox and ledger entries. Replaying dues, ticket/order confirmation, expense payment and publication must leave the settled records and totals unchanged. Look for the final PASS line covering money sources, receipts, tasks, admission and duplicate-free retries.

Run the client commands in the preceding Expo section, followed by an Expo-enabled production build and `npm run test:expo-web`. Save `git rev-parse HEAD`, Node version, command results and the CI run URL with release evidence. These automated checks establish API integration and restart persistence, not a completed interactive native/web journey.

## Interactive client journey

Use the same-origin Expo build above with an isolated synthetic database. All payments below are officer records, not payment gateway charges. Choose your own private demo password; do not use real member data.

1. From sign-in, create a member account, or open the public announcement archive and guest booking. A signed-in member's **My pass** shows their QR, short code, membership and expiry, tickets and orders.
2. As an organizer, **My pass → Membership desk** records dues using a unique payment reference and queues renewal reminders. A repeated reference does not renew twice. Members have no self-confirm payment control.
3. **Events → New event** publishes title, venue, timezone-qualified date, capacity and member/guest prices. Select an event, reserve a member or guest ticket, and inspect its server-fixed price and hold expiry. Save the private guest link: browsers show QR, code, payment and admission state; API callers still receive JSON.
4. An officer uses the event ticket register to confirm payment or cancel a hold; owners can cancel their own pending holds. Select the event before entering a code at the door. Native also offers QR camera scanning and haptic feedback; web uses typed codes. Repeat admission shows the original time. Expired, unpaid and invalid tickets never admit.
5. **Shop → New product** creates size-specific inventory. Reserve a unit, record payment as an officer, and mark it handed over as an authorized organizer. Holds reserve stock; sold-out and expired responses remain visible and refresh stock. **My pass** also lists orders.
6. **News** publishes a dated announcement to active members. An uncertain retry retains the same publication key. Members see notifications; authorized officers can inspect the explicitly simulated outbox. **Tasks → New task** assigns a member and optional due date; the assignee can change status. Progress defines on-track as done or not overdue.
7. **Claims** uploads a JPEG, PNG or PDF no larger than 5 MB and submits a purpose and rupee amount. Drafts retain their uploaded receipt after errors. The client keeps a submission UUID: retries return the same expense; reusing it with different content is rejected. A different finance officer approves or rejects, then records reimbursement payment. Self-review controls are hidden.
8. **Treasury** shows income/outflow/balance, officer-attributed ledger rows and exact-source details. Authorized receipt downloads retain cookie/bearer security; CSV exports use the same authorization. Native saves to a temporary cache file for the share sheet and deletes it afterward.

Local browser evidence, 10 October 2026: synthetic admin ticket reservation → payment → admitted → repeat rejected with original timestamp; merchandise reservation → paid → fulfilled; announcement publication → three simulated outbox recipients; PDF upload → submitted → approval/payment by a different treasurer; exact ticket ledger-source inspection; authorized receipt download with SHA-256 identical to the uploaded bytes. All actions used loopback API storage, not production. Automated tests cover expense retry identity, changed-content/cross-owner rejection, guest HTML escaping and JSON negotiation, download authentication and stale-session responses, missing-token cleanup and session revalidation failures.

The browser walkthrough is selected-flow evidence, not exhaustive acceptance. Physical Android/iOS camera permission and scanning, haptics, picker/share behavior, LAN reachability and installed Windows PWA tests remain required. Native bundle export verifies compilation only. No physical device or hosted deployment was exercised here; keep issues #10–#15 open until their outstanding acceptance evidence is complete.

For final acceptance, record a separate row for Android/iOS and web/PWA with the exact release SHA, device/browser, API address, synthetic actors, each interaction above and observed restart/retry behavior. Keep a row blocked where a required client screen is absent. Do not substitute direct API calls for UI evidence or close #15 until the required native/web and LAN demonstrations are complete. Real payment gateways and external message delivery remain out of scope.
