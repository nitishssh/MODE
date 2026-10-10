# Issue #13: remaining work

Issue: https://github.com/nitishssh/MODE/issues/13

Status: In progress. This is a draft handoff checklist, not an implementation or acceptance sign-off.

Owners: @Azmanshaikh.

Snapshot: 10 October 2026, main `771ec78d7ecec9e5c0d597951877e5968ead7e84`. Recheck this snapshot when implementation resumes; the linked issue remains the acceptance source of truth.

## Existing work

PRs #21 and #25 delivered web task, expense and treasury interfaces, receipt handling, CSV export and mobile navigation. The browser payment prompt was not exercised end to end in the recorded #25 evidence.

## Dependencies

#7 finance, #9 tasks and #10 Expo shell. Coordinate source attribution/navigation with #7.

## Completion checklist

- [ ] Build Expo volunteer rows with persisted assignee, due date, permission-aware state updates and the agreed progress calculation.
- [ ] Implement expense submission with required receipt, distinct submitted/approved/rejected/paid states, upload errors and authorized review/payment actions.
- [ ] Show API-backed income/expense/balance totals with tabular rupees, officer attribution and navigation from every non-opening ledger entry to its source.
- [ ] Restrict finance to ledger:read holders and receipt retrieval to authorized users; integrate CSV download if E3 remains in scope.
- [ ] Verify loading, empty, row-error and retry states without losing input, including the receipt and payment flow end to end.
- [ ] Verify native and web against real APIs and record device evidence. Optional E1 remains optional and is not included as delivered.

## Evidence required before completion

Link the implementation commits and passing checks; record reproducible demo steps and any required physical-device evidence. Keep unchecked items visible and do not mark the issue complete because this checklist is merged. Payments and outbox delivery remain simulated under the MVP scope. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.
