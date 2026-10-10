# Demo and release checks

## Runnable starter acceptance

1. Use Node 24, run `npm ci`, then `npm run dev`.
2. Open http://127.0.0.1:3000. Confirm the fictional-data notice and dashboard records load.
3. Open Members, add a fictional name/email, and verify the new unpaid member appears.
4. Refresh and restart the server: the member remains present.
5. Submit the same email again: show a useful duplicate error without adding another record.
6. Check invalid name/email handling. Navigate all six areas and confirm unfinished flows are marked as previews.
7. Visit `/api/health`; it returns 200 and reports SQLite schema version 1.
8. Run `npm run typecheck`, `npm test`, `npm run build`.
9. Run `npm start`: reads work; writes return 403 by default. Demo opt-in is only for a trusted private/local instance.

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
