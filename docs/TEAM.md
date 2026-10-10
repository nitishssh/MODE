# Team ownership — 10 October 2026

The approved phased plan moves announcements, volunteer tasks and reimbursements to Nitish so Divyank can focus on the shared foundation, memberships, tickets and merchandise. Azman owns the Expo frontend. Deepak is no longer in the active team.

| Owner | Responsibilities | Initial ticket sequence |
|---|---|---|
| **Nitish — @nitishssh** | Integration, contracts and auth review; announcement, volunteer and reimbursement backends; assisted Expo scaffold handoff; CI, LAN/hosting, release and evidence | Shared #2; #8 (P4) then #9/#7 (P5); scaffold support on #10; #14–#16 delivery/integration/release |
| **Divyank — @DIVYANK-BHARDWAJ** | Shared membership/ledger/QR foundation, auth backend, dues, ticketing, merchandise, migrations and module tests | Completed base #3; #2 (P0) -> #4 (P1) -> #5 (P2) -> #6 (P3) |
| **Azman — @Azmanshaikh** | Expo Router screens for Android/iOS/web, Ruled Paper design, role-aware navigation, Member Pass, native scanner, forms and treasurer register | #10 scaffold handoff/shell (P6a/P6); #11–#13 screens (P6) |

## Working agreement

- Nitish owns final scope/API contract decisions; publish changes in the issue and `docs/API.md` before integrating.
- Backend and frontend may proceed in parallel against agreed types. Dependency lists describe integration prerequisites, not a requirement to wait before designing UI.
- Every ticket has a primary assignee; ask for focused help when blocked rather than silently changing ownership.
- Branch from the current `main`, use `codex/<issue>-<short-name>` or a clearly named team branch, and link the PR to the issue.
- Move cards Backlog -> Ready -> In progress -> In review -> Done. Keep at most one active feature per person where practical.
- Done requires the ticket acceptance criteria, relevant tests and a working demo. A scaffold or mock payment does not complete the related feature ticket.
- Module owners write their own contract/failure tests; Nitish owns the cross-module semester journey. Shared migration versions and contracts must be coordinated before merging.
- Maintain synthetic demo data. Keep credentials in environment configuration and avoid shared passwords.

## Scope

The six required workflows are memberships; online event tickets/check-in; website and mailing announcements; merchandise/size stock/orders; volunteer task assignments; and club income/expenses/reimbursements. Whole-college academics, exams and tutoring are outside this MVP.

The client is Expo Router/React Native; the backend remains Next.js + SQLite + Zod on Node 24. Android/iOS use Expo Go and Windows uses the web PWA. Payments are simulated officer confirmations and announcement delivery is a transactional outbox; real gateways/email/WhatsApp, refunds, fundraiser income, installable APK and officer handover (#17) are deferred.

At 18:00 IST, Nitish reviews P0/P6a progress and re-baselines the schedule. At the 21:00 cut-line, approved reductions may drop merch discount/fulfilment, simplify task progress, remove optional E1/E3/E4 and make Windows PWA verification stretch. Ledger source links, the door contract and reconciliation remain mandatory. At 22:00, portal requirements determine whether hosted deployment is mandatory.

Core acceptance target: 11 October 2026, 10:00 AM IST, based on the event page's coding deadline. Nitish must recheck submission instructions and video timing at release. The GitHub milestone is a calendar-day target; it does not encode the exact hour.
