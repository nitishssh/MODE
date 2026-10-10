# Demo and release checks

## Runnable starter acceptance

Foundation acceptance was verified in [merged PR #26](https://github.com/nitishssh/MODE/pull/26). See [the foundation guide](FOUNDATION.md#acceptance-evidence) for the release commit, passing CI and browser evidence. Repeat these checks for a new release candidate.

1. Use Node 24, run `npm ci`, then `npm run dev`.
2. Open http://127.0.0.1:3000 and sign in with a synthetic account. Confirm the dashboard records load.
3. Sign in as `organizer@example.com` using `MODE_DEMO_PASSWORD` (development default `mode-demo-2026`) and create a fictional member from Members. The same flow is available through `POST /api/auth/login` and `POST /api/members` with a cookie or bearer token; see [API contracts](API.md).
4. Read `GET /api/members` with that session, restart the server, and read again: the new unpaid member remains present.
5. Submit the same email again through the authorized API: expect 409 without adding another record.
6. Check invalid name/email handling through the authorized API. Navigate all six web areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports SQLite schema version 10.
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

Run `node --import tsx --test tests/announcements.test.ts` for reproducible validation, role checks, IST expiry boundaries, database uniqueness, injected delivery/audit failure rollback, retry persistence, notification isolation and v9 migration coverage. After `npm run build`, `npm run test:foundation` also checks publication, protected outbox, member notifications and replay through the built HTTP server across a real restart. The publishing/inbox/outbox UI remains the separate #12 frontend task.

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
