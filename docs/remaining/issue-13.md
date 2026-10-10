# Issue #13: remaining work

Issue: https://github.com/nitishssh/MODE/issues/13

Status: In progress. This is a handoff checklist, not implementation or final acceptance sign-off. Issue #13 remains open.

Owner: @Azmanshaikh.

Snapshot: 10 October 2026, main `498c4a888dc11acfd748c9bbf67c210b5aa5e93c`. Recheck against the linked issue when work resumes.

## Delivered foundations

- PR #35 added Expo task rows showing persisted assignee, due date, status and overdue indication. Status actions are limited to the assignee or a `tasks:write` holder, with pending-write protection and row errors.
- PR #35 added a `ledger:read`-protected Expo treasury screen with API-backed income, expense and balance totals, category summaries, tabular rupees, refresh and cached timestamps. The current PR adds individual rows and exact-source inspection.
- PR #36 completed the backend and legacy web reimbursement flow: required private receipts, approval/rejection/payment states, officer-attributed ledger entries, source details and canonical CSV export. Its recorded browser walkthrough covers the successful receipt-to-payment flow; this does not establish Expo/native acceptance.
- PR #35 supplied the shared Expo shell, session handling and client CI checks.

Evidence: [Expo implementation review](../reviews/pr35-expo-shell.md), [reimbursement verification](../REIMBURSEMENT-VERIFICATION.md), and [demo steps](../DEMO.md).

## Remaining implementation and acceptance

- [x] Add on-track task progress: completed or not overdue, with explicit total/done/overdue counts; retain assignee, due date and permission-aware status.
- [x] Implement Expo expense submission with a required receipt and file/type/size error handling; implement authorized approve/reject/pay actions with distinct submitted, approved, rejected and paid states.
- [x] Extend the Expo treasury register with individual ledger rows, officer display attribution and navigation from every non-opening entry to its exact source. Preserve API-backed totals and tabular rupees.
- [x] Integrate authorized receipt retrieval and web CSV download; preserve finance visibility restrictions and enforce permissions through the API.
- [ ] Verify loading, honest empty states, row errors and retry without losing input, including failed upload/payment/source requests and the complete receipt-to-ledger flow.
- [ ] Verify native and web against real APIs using synthetic accounts, and record physical-device evidence with the tested commit and environment.
- [ ] Reconcile all issue #13 acceptance criteria with evidence before closing it. Optional E1 remains optional and is not declared delivered.

## Dependencies and verification boundary

Backend finance is tracked by #7, tasks by #9, the shell by #10 and platform verification by #14. Full task/finance acceptance remains #13's responsibility.

The current PR implements these client screens and records local browser checks in docs/DEMO.md. Physical-device checks remain open. Payments and outbox delivery remain simulated. The issue's final acceptance target is 11 October 2026, 10:00 AM IST.
