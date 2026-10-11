# MODE: independent hackathon jury assessment

Date: 11 October 2026 (Asia/Calcutta). Scope: current local working tree, including uncommitted work. Three separate agents audited product, engineering, and UX without receiving one another's scores. The chair corroborated priority source findings and ran production build and HTTP acceptance checks. This is an advisory panel simulation, not an official Odoo verdict or prediction of placement.

**Panel result: 76/100** (equal-weight mean 76.3). Substantial functional prototype, strongest in connected financial workflows. Operational gaps and inconsistent frontend recovery hold it below a polished finalist demonstration standard. Competitor submissions and the actual presentation were not assessed.

## Scoring

| Judge | Score | Independent rubric |
|---|---:|---|
| Product and problem fit | 76/100 | Understanding/usefulness 22/25; completeness 21/30; differentiation 11/15; feasibility 11/15; demo/team evidence 11/15 |
| Engineering and security | 81/100 | Access/privacy 17/20; financial/workflow correctness 21/25; architecture 16/20; operational resilience 11/15; verification 16/20 |
| UX, frontend and mobile | 72/100 | Workflows/navigation 23/30; recovery 13/25; accessibility implementation 17/20; responsive/mobile implementation 11/15; clarity/consistency 8/10 |

These are our weights. The repository's account of the Student Organization System brief covers members, events, announcements, merchandise, volunteer tasks and treasury; its screening categories are recorded in `docs/designs/mvp-ledger-spine-phased-port.md:13` and `:27`. No original problem PDF or official weighted score sheet was available. Earlier event notes informed the initial checklist; the official event page was not refreshed. Odoo framework integration was not assumed mandatory. UX marks assess implementation evidence, not measured visual quality.

## What earns credit

- The application connects real workflows: membership eligibility changes pricing; ticket and stock reservations affect availability; officer confirmations and reimbursements post to a shared ledger.
- Financial records use integer paise, transactional posting, source links and replay handling. This is a stronger demonstration than disconnected CRUD screens. See `src/lib/modules/ledger.ts:37` and `src/lib/modules/workspace.ts:221`.
- Authentication and authorization include revocable sessions, role-based actions and receipt ownership. Membership status is derived from expiry rather than a manually maintained flag.
- The frontend includes labelled inputs, keyboard/dialog foundations, loading/error/empty states, camera explanations and a typed-code fallback. These deserve implementation credit, pending visual/device verification.
- Git history shows contributions associated with Nitish, Divyank and Azman. Alias duplication and merge commits prevent interpreting commit counts as ownership percentages.

## Priority findings

All findings below are based on inspected source. The listed failure scenarios were not reproduced in a browser during this run.

### 1. P1: old admission remains visible after a failed scan

`src/app/app/(shell)/events/[id]/door/page.tsx:60` clears errors and starts loading but does not clear the previous result; its catch only sets an error. The result panel at line 201 remains visible. After admitting person A, a slow or failed request for person B leaves A's large green ADMIT decision on screen. Clear the decision when a scan starts and display pending/unknown until the current request completes. Reproduce with successful admission followed by an offline scan.

### 2. P2: fundraising targets cannot be configured for new events

`src/lib/modules/events.ts:31` defines strict create/update fields without a fundraiser target; insertion at line 149 and update at line 168 omit it. The database defaults targets to zero (`docs/schema.sql:82`), while `src/lib/modules/workspace.ts:321` calls a zero target on track. The event screen displays that status (`src/app/app/(shell)/events/[id]/page.tsx:220`). Seeded examples therefore show a capability a fresh organizer cannot configure. Add editable targets and a truthful No target set state.

### 3. P2: expense retry changes its receipt identity

`src/app/app/(shell)/expenses/page.tsx:87` uploads a new receipt on every submit while reusing the submission ID. The backend at `src/lib/modules/workspace.ts:182` rejects an existing submission with a different receipt ID. If submission commits but its response is lost, retry produces a conflict instead of recovering the saved claim. Retain the uploaded receipt ID and immutable submission payload until the outcome is resolved. This is a recovery defect, not evidence of duplicate ledger posting.

### 4. P2: free guest bookings bypass the pending-hold cap

`src/lib/modules/events.ts:296` counts only pending-payment guest tickets. Free tickets become paid immediately with no hold expiry at line 256. Repeated bookings using invented distinct email addresses can consume free-event capacity without the pending-hold cap applying. Capacity itself is still enforced. Add verification or abuse controls appropriate to free admission.

### 5. P2: external payment references are unique only within each module

Uniqueness checks in `src/lib/modules/events.ts:320`, `src/lib/modules/merchandise.ts:264`, and `src/lib/modules/dues.ts:55` query their own tables. One external-transfer reference can therefore be recorded against a ticket, dues and merchandise separately. If references identify unique transfers, this can overstate recorded receipts. Define whether split allocation is supported, then use a shared payment registry or explicit allocations. Same-source retry protection does not establish cross-module settlement correctness.

### 6. P2: inconsistent navigation and localization

- `src/app/app/_components/shell.tsx:251` exposes a language selector, while its navigation from line 32 and business screens use English literals. Locale changes can update document language/direction without translating these screens.
- `src/app/page.tsx:2667` renders the older authenticated workspace at `/`, while sign-in leads to `/app`. Choose one canonical demo surface.
- `src/app/app/(shell)/events/[id]/page.tsx:233` links to an event-filtered task board, but `src/app/app/(shell)/tasks/page.tsx:27` does not initialize its filter from the query string.

Additional engineering concern: `src/lib/modules/events.ts:123` lists stored registration counts without releasing expired holds. Availability can remain stale until a separate operation performs cleanup. Fresh dashboard reads can also trigger cleanup, so this depends on which endpoint is read.

## Completion boundaries that affect judging

- Announcement archive and member notifications work; email outbox delivery is simulated (`src/lib/modules/announcements.ts:62`). WhatsApp has no active transport by default (`src/lib/whatsapp-worker.ts:11`). Award partial external-communication completion.
- Payments record an authorized officer's assertion that cash or UPI was received. They do not transfer money, reconcile a bank account or prove settlement. This can be a valid hackathon scope if presented accurately.
- Single-club operation fits the recorded association scenario. It does not establish campus-wide multi-club administration.
- Native camera/picker/sharing, installed Windows PWA, and hosted/LAN journeys remain unverified. The README explicitly states there is no offline cache/service worker; a local server does not make a disconnected phone operational.
- No real-club interview or measured time-saving evidence was found in the inspected product materials. Adoption impact remains a hypothesis.

## Verification performed during this audit

| Check | Result |
|---|---|
| Production `npm run build` | Passed; warning about dynamic filesystem tracing in database receipt-path handling |
| Backend TypeScript | Passed, independently checked by engineering agent |
| Generated client contracts | Matched server |
| Built HTTP foundation acceptance | All eight reported groups passed on an isolated synthetic SQLite database |
| Full backend unit suite / schema and API-doc checks | Could not start: Windows sandbox `uv_os_get_passwd` returned `ENOMEM` in tsx |
| Expo client typecheck | Unavailable dependencies/configuration, including Expo base tsconfig; correctness not established |
| Client unit tests | Did not start due to the same environment error |
| Browser and physical-device audit | Not performed; browser approval service unavailable |

The HTTP acceptance run verified built HTML/health/database reads, authorized member creation, rejection of malformed/duplicate inputs without writes, dues, ticket admission, merchandise fulfilment, volunteer work, receipt reimbursement, publication/protected simulated outbox/member notification, session/data persistence after an actual server restart, and payment replay without duplicate ledger entries. These checks establish those scenarios; they do not prove the entire product has no defects.

Local evidence: `tmp/jury-build.log` and `tmp/jury-foundation.log` (ignored working artifacts). No product source was intentionally modified by the panel. The workspace had extensive existing changes and additional concurrent edits during the audit, so these results are not a certification of the final working tree or a submission SHA. Freeze a candidate and rerun checks before relying on release evidence.

Automatic approval review rejected browser access and could not complete the test escalation because its configured review API returned HTTP 404, deployment not found. Neither blocked action executed. This is an approval-service failure, not a product failure or a determination that those actions were unsafe. Browser access was not bypassed.

## Repair order and jury demonstration

1. Fix stale scanner decisions and expense-response-loss recovery.
2. Make fundraiser goals configurable and verify a newly created event.
3. Define cross-module external-payment reference semantics and protect free guest booking.
4. Select `/app` as the demonstrated surface (or another explicitly chosen surface), repair event-task navigation, and make language support truthful.
5. Freeze a candidate, run checks with installed dependencies, and verify one phone plus desktop flow. Present external integrations according to their actual state.

Suggested five-minute story: explain who is active, who may enter, and where recorded money came from; register a fresh member; record dues; book at the member price; confirm and admit once; reject the repeated admission; briefly show merchandise/task handling; submit and reimburse a receipt; finish on the ledger's exact source records. Show announcement archive/member inbox while explicitly labelling external sending simulated. Prioritize fresh data over a dashboard tour.

Questions the team should be ready to answer:

- Create a new fundraiser: where is its target set, and what does on track mean?
- What exactly verifies payment, and what relies on the officer?
- Show a retry that leaves exactly one financial entry.
- Explain the database guarantee for the final ticket or hoodie.
- What does the door show immediately after connectivity fails?
- Can a normal member retrieve another person's receipt?
- Which actual devices and deployment completed the journey?
- What happens to paid tickets after cancellation?
- Each contributor: explain an owned change, a tradeoff and a failure case.

**Chair's verdict:** lead with accountable club finances and reliable admission. The engineering is substantial enough to support that story; fixing the highlighted operating failures and proving a focused fresh-data demo should take priority over expanding the feature list.
