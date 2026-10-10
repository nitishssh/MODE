# Issue #15: remaining work

Issue: https://github.com/nitishssh/MODE/issues/15

Status: In progress. This is a draft handoff checklist, not an implementation or acceptance sign-off.

Owners: @nitishssh.

Snapshot: 10 October 2026, main `771ec78d7ecec9e5c0d597951877e5968ead7e84`. Recheck this snapshot when implementation resumes; the linked issue remains the acceptance source of truth.

## Existing work

Merged module tests cover membership, tickets, merchandise, workspace permissions and ledger reconciliation. PR #26 adds an HTTP foundation check across server restarts. tests/journey.test.ts is still absent at the checked main commit; these checks do not replace the full semester journey.

## Dependencies

#4–#9 backend, #10–#13 clients and #14 platform delivery.

## Completion checklist

- [ ] Add tests/journey.test.ts using a fresh database: member registration, officer dues, member pricing, ticket hold/payment/check-in, merchandise order/payment, announcement recipients/notifications, volunteer task and receipt reimbursement.
- [ ] Exercise member, volunteer, organizer, treasurer and admin boundaries, including unauthorized actions, expiry and repeated operations across modules.
- [ ] Assert exactly one matching ledger entry for every realized money source, no orphan non-opening sources and matching income/expense/balance totals.
- [ ] Cover last-seat races, expiry/rebooking, stale confirmation, zero stock, the door decision table, membership boundaries, reminders, receipt validation and announcement fan-out.
- [ ] Run npm run check and npm run test:foundation plus declared client checks after #10 supplies them; record commands, results and the exact release commit.
- [ ] Demonstrate the journey on native and web, including API restart persistence, and update docs/DEMO.md with reproducible synthetic-data steps.

## Evidence required before completion

Link the implementation commits and passing checks; record reproducible demo steps and any required physical-device evidence. Keep unchecked items visible and do not mark the issue complete because this checklist is merged. Payments and outbox delivery remain simulated under the MVP scope. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.
