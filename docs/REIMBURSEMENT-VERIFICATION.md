# Issue #7: local verification

Verified on 10 October 2026 on branch `receipt-ledger-acceptance`, based on main `771ec78d7ecec9e5c0d597951877e5968ead7e84`. This records local implementation evidence, not a merged release or a deployment.

## Automated checks

`npm run check` passed: TypeScript, API documentation checks, **70 tests**, and the Next.js production build. The final build emitted no warnings. `git diff --check` passed.

Receipt tests cover JPG/PNG/PDF byte detection, disallowed WebP and spoofed types, the exact 5,000,000-byte boundary, bounded oversized request bodies, required receipt ownership, missing files, protected attachment headers, failed metadata insert cleanup, and released v9 migration without moving legacy files or losing claim links.

The financial harness covers approval without outflow, failed transaction rollback, duplicate references, different-reference conflicts, paying-officer attribution, paid-source reconciliation, and simultaneous payment attempts from two processes producing one outflow. CSV tests parse the canonical seven columns, verify exact source identities and officer names, escape spreadsheet formulas and quoted multiline text, deny forbidden access, and independently reconcile income, expenses and balance.

## Browser walkthrough

Used a fresh synthetic database on `http://127.0.0.1:3027`, with the club clock fixed to 10 October 2026.

1. Signed in as active@example.com and submitted “Synthetic travel receipt” for ₹123.45 with an attached synthetic PDF. The claim appeared as Pending review.
2. Signed in as treasurer@example.com and approved it. Balance remained ₹1,850.00; Approved · unpaid became ₹123.45.
3. Used Mark paid and the inline Payment reference form with SYNTHETIC-TRAVEL-1. The claim became Paid, outflow became ₹473.45, balance became ₹1,726.55, and approved-unpaid returned to zero.
4. Opened the exact expense source from the ledger. It showed the claim ID, submitter, purpose, paid state and reference; Recorded by showed Treasurer Demo.
5. Downloaded the protected receipt and verified its SHA-256 matched the uploaded fixture: `2F81EECEEB2E996CBCB9817075D663305673EC0074FAC12C66E472CA88D504D1`.
6. Exported CSV from the web register. It contained one ₹123.45 reimbursement, the officer display name and source ID, and the three opening balances. Income ₹2,200.00 minus expenses ₹473.45 matched the register balance ₹1,726.55. Browser error logs were empty.

The viewport used the mobile navigation menu and a horizontally scrollable ledger. Screenshot evidence is retained locally in `.data/receipt-ledger-browser.jpg`; synthetic database and downloaded files are not committed.

## Compatibility and delivery boundaries

New claims require attachments. Historical receiptless claims retain their state and payment behavior. Legacy files, including WebP receipts, retain their existing paths and authorization; only new uploads are restricted to JPG/PNG/PDF. The old export URL retains its original layout for existing callers, while the web register uses `/api/ledger/export.csv`.

The interactive engineering review was redirected to implementation by the user; this file does not claim a completed plan-review workflow. Expo/native screens and device acceptance remain in #13. No hosted deployment or physical-device acceptance was performed.
