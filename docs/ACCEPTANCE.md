# Backend acceptance — 10 October 2026

Scope: #1 runnable starter; #2 membership/ledger/native-auth foundations; #4 dues; #5 tickets/door API; #6 merchandise. Baseline: main `08225839bdf70a2d4475c33d573ad4a393ad7e98`. Verification used Windows, Node 24.21.0, Next.js 16.4.0, fresh synthetic SQLite files and owned loopback development servers.

## Reproduce

Run `npm ci`, `npm run check`, and the [backend demonstration](DEMO.md#backend-acceptance-foundation-dues-tickets-and-merchandise). The focused command in that walkthrough exercises all five issues without requiring a phone or external service.

## Evidence by issue

| Issue | Verified acceptance |
|---|---|
| #1 | Fresh Node 24 install; development HTML/dashboard and health; authorized member creation; duplicate 409 and invalid 400; missing/forbidden auth 401/403; member persistence after actual API restart; environment/setup/CI files present. Responsive web behavior is also evidenced by merged PR #25's 390px browser run. |
| #2 | Bearer/cookie identity, invalid bearer precedence, cookie CSRF, bearer mutation, development PATCH CORS, session revocation and restart persistence; member passes and bounded token collision tests; exact SQL/JS agreement across IST midnight; source-complete ledger repair below. |
| #4 | Configured dues, first/early/expired +365-day renewal, expiry-day boundaries, payment replay, role checks and one reminder/notification/outbox per member-expiry; live dues recording/retry persisted across API restart. |
| #5 | Member/guest price and identity rules, holds, expiry/rebooking, stale/duplicate confirmation, complete typed door-result table, conditional check-in and reports; two simultaneously released processes compete for the final seat and exactly one reserves it. Live typed scan admits once and remains checked in after restart. |
| #6 | Size stock, member pricing, stock zero, pending limit, hold expiry/cancellation, confirmation replay and fulfilment; two simultaneously released processes compete for the final unit and exactly one reserves it. Live ordering/payment/fulfilment passes. |

Baseline `npm run check` passed all 60 original tests, typecheck, contract documentation checks and production build. Four acceptance cases were added: source completeness/matching, exact SQL boundary agreement, simultaneous ticket reservation and simultaneous merchandise reservation. The final `npm run check` passed all **64 tests**, typecheck, contract documentation and production build.

Foundation PR #26 subsequently merged as `c9c157bc78d21fb55b921f1f18a665a67ed0efe8` and closed #1 with independent development-browser and restart evidence. Its `npm run test:foundation` command is retained; see [FOUNDATION.md](FOUNDATION.md). This acceptance change completes the remaining #2/#4/#5/#6 review work rather than reopening #1.

The fresh live API walkthrough produced one dues payment (50000 paise), one ticket payment (5000), and one merchandise payment (2500). The treasury read after API restart returned **242500 paise** including the opening 185000, with exactly one entry for each payment reference. It also verified 201 on initial payment confirmation, 200 on replay, typed admission/repeat admission, bearer precedence, cookie CSRF and logout revocation.

## Reconciliation defect and repair

The original harness only walked existing ledger rows. An isolated probe recorded dues, deleted that payment's ledger row, and still obtained empty orphan/duplicate arrays and zero unsourced rows. The probe reproduced this twice: the paid source remained while the balance silently dropped by 50000 paise.

The repaired harness also enumerates every realized dues/ticket/merchandise/expense source. `missing` reports absent rows; `mismatched` reports wrong amount, direction, club or officer. Zero-value/free and unpaid sources do not require an entry. Existing orphan/duplicate/opening checks remain.

`tests/ledger.regression-1.test.ts` creates all four source types and commits missing/incorrect ledger data through a separate connection. It fails against the original implementation and passes with the repair, checks restoration to a clean report, and excludes free/unpaid sources. No production test hook, data migration or financial mutation behavior changed.

The original P0 test did not execute the exact SQL boundary matrix, and the original capacity tests used sequential connections. New tests exercise those documented contracts without replacing or weakening existing tests.

## Limits and retained evidence

These checks do not complete Expo/native screens, physical camera scanning, hosted delivery, the full semester journey, or submission evidence (#10–#16). No real payments or messages were sent. Local fixture databases and sanitized capture logs were retained under the acceptance checkout's ignored `.data/review-acceptance/`; owned development processes were stopped.

Two probe mistakes were corrected without product changes: initial confirmations correctly return 201 (the first probe expected 200), and corruption must be committed before another SQLite connection can observe it. Raw database inspection immediately after forced Windows process shutdown hit a SQLite I/O error; final ledger verification used the supported treasury API after a successful restart. The file-level corruption regression uses closed/controlled connections and passes separately.

Migration coordination remains append-only: released foundation v3, dues v4, tickets v6, merchandise v8 and workspace v9. Do not reuse skipped versions v5/v7 or merge old branch migration histories over these releases; allocate new versions above the current main schema. Ownership, schedule checkpoints and deferred scope remain as documented in TEAM.md and the board.
