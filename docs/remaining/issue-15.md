# Issue #15: remaining work

Issue: https://github.com/nitishssh/MODE/issues/15

Status: In progress. Backend journey and restart automation are implemented in this PR; native/web acceptance remains incomplete.

Owners: @nitishssh.

Base snapshot: 10 October 2026, main `0e3210df1027b4586d2ad30952af50abacbb9882`. The linked issue remains the acceptance source of truth. Verification commands and evidence are recorded in [the semester journey walkthrough](../DEMO.md#automated-semester-journey-15).

## Existing work

`tests/journey.test.ts` now follows a newly registered member through dues, active-member ticket and merchandise pricing, paid ticket check-in, announcement delivery, an assigned volunteer task, private receipt submission and finance approval/payment. It uses real route handlers with cookie and bearer sessions and an isolated file database. It also advances the clock to verify that session/membership expiry removes new pricing/audience eligibility without changing earlier payments or frozen publication recipients.

`scripts/check-foundation.mjs` now creates journey state through a built server, restarts that server against the same SQLite and receipts directory, then verifies retained records, private receipt bytes, task and attendance states, source links, totals and duplicate-safe payment/publication retries. Existing module suites retain race, boundary, rollback and reconciliation-corruption coverage.

## Dependencies

#4–#9 backend, #10–#13 clients and #14 platform delivery.

## Completion checklist

- [x] Add tests/journey.test.ts using a fresh database: member registration, officer dues, member pricing, ticket hold/payment/check-in, merchandise order/payment, announcement recipients/notifications, volunteer task and receipt reimbursement.
- [x] Exercise member, volunteer, organizer, treasurer and admin boundaries, including unauthorized actions, expiry and repeated operations across modules.
- [x] Assert exactly one matching ledger entry for every realized money source, no orphan non-opening sources and matching income/expense/balance totals.
- [x] Cover last-seat races, expiry/rebooking, stale confirmation, zero stock, the door decision table, membership boundaries, reminders, receipt validation and announcement fan-out through the existing required module suites.
- [ ] Record the final PR-head CI results for root and client checks; repeat affected validation after any further changes.
- [ ] Demonstrate the journey on native and web, including API restart persistence, and update docs/DEMO.md with reproducible synthetic-data steps.

## Evidence required before completion

Link the implementation commits and passing checks; record reproducible demo steps and any required physical-device evidence. Keep unchecked items visible and do not mark the issue complete because this checklist is merged. Payments and outbox delivery remain simulated under the MVP scope. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.

The Expo shell currently exposes overview, pass, task status and treasury totals. Full booking/payment/scanner, announcement, receipt expense and detailed ledger/source screens remain dependencies under #10–#13. Automated API success is not evidence that those screens or physical-device acceptance are complete. LAN native/web journey evidence remains mandatory; hosted verification is conditional on #14's decision.
