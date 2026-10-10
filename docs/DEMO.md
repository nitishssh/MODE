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

## Treasury export and event reports

1. Sign in as treasurer@example.com after recording an external reimbursement. Open Treasury and compare the paid expense, payment reference and remaining balance.
2. Open `/api/ledger/export` in the same authenticated browser. Save the CSV and check that each confirmed payment has one row. Submitted, rejected and approved-but-unpaid expenses must not reduce the ledger balance. Text beginning with spreadsheet formula characters is escaped.
3. As an organizer or administrator, request `GET /api/events/{id}/report` for an event in the same club. Replace `{id}` with its actual ID. Compare ticket counts and realized revenue with confirmed bookings, and compare the added task counts with the task board. Fundraiser income comes from the same event-attributed ledger.
4. Repeat the export without signing in and expect 401. A signed-in ordinary member receives 403. Reports for another club are unavailable.

For LAN setup and home-screen limitations, follow [the README](../README.md#lan-and-home-screen-access). This walkthrough describes checks to perform; it is not a claim that hosted or physical-device checks have passed.
