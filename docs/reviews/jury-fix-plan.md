# Jury findings: implementation and PR plan

Status: implemented in the original writable checkout following the user's instruction to implement. Publication remains blocked. See [implementation and verification](jury-fix-verification-2026-10-11.md). The full autoplan review pipeline has not completed.

## Implementation plan

Deliver the remaining jury-audit fixes in one focused PR against main. The intended isolated checkout at `C:/Users/Nitish/.codex/worktrees/hackathon-jury-fixes/MODE` was not writable because approval review failed. Implementation therefore used the original writable MODE checkout, with existing source copied to `tmp/jury-baseline` before edits. Preserve unrelated uncommitted work. Before publication, port only these fixes onto current main and revalidate, because the original checkout is behind upstream. Use branch `fix/jury-workflow-reliability` and PR title `Fix admission, reimbursement and club finance workflows`.

### Scope

1. Clear the previous admission decision and takeover flash when a scan starts. A failed or pending request must never display the previous attendee's green admission. Preserve duplicate-scan guards and camera cleanup. Apply to web and Expo where the same issue exists.
2. Preserve the uploaded receipt and immutable claim payload during expense retries. If submission succeeds but the response is lost, retry must recover the original claim. An intentional edit must not accidentally reuse an incompatible submission identity. Cover web and Expo.
3. Add a nonnegative integer-paise fundraiser goal to event creation/editing, shared contracts and both relevant forms. Preserve a zero default for existing callers. Show No target set when the goal is zero; do not label it On track.
4. Close the free-guest booking abuse gap while preserving legitimate guest entry and event capacity. Review bounded guest allocation versus verified member/officer booking for free events before selecting the behavior; do not silently eliminate the guest workflow.
5. Define one external-transfer reference as one receipt of funds per club across dues, tickets and merchandise, unless an explicit split allocation exists. Preserve same-source idempotency and transactional concurrency. Use a shared uniqueness mechanism and handle historical cross-module collisions without dropping or rewriting financial history.
6. Refresh expired holds when reporting event availability while preserving atomic reservations and active holds.
7. Read the event filter from task links. The implementation checkout still has the English workspace and legacy root dashboard: signed-in root visits now reach `/app`, and an explicit multilingual legacy link replaces its ineffective language switch. Current upstream already has translated workspace code and a new landing entry, so porting must reconcile those differences rather than overwrite them.

### Existing components to reuse

- `src/lib/modules/events.ts`: event validation, conditional reservations and ticket confirmation.
- `src/lib/modules/workspace.ts`: expense replay comparison, private receipts and fundraising reports.
- `src/lib/modules/dues.ts`, `merchandise.ts`, `ledger.ts`: transactional income posting.
- `src/app/app/(shell)/events/[id]/door/page.tsx`: current scanner and takeover flash.
- `src/app/app/(shell)/expenses/page.tsx` and Expo expense screen: submission lifecycle.
- Existing migrations, shared contracts and domain regression tests.

### Acceptance and regression cases

| Behavior | Required evidence |
|---|---|
| Admission recovery | Admit A; start B; no A decision remains while pending or after rejection/network failure; B's eventual result alone is shown |
| Claim recovery | Save claim then lose response; retry uploads no new receipt and returns same claim; changed payload handled explicitly; another member cannot reuse the receipt |
| Fundraising | Create/edit positive target; reject negative/fractional/unsafe values; zero target shows unset state; ordinary members cannot edit |
| Free guests | Repeated distinct-email free bookings cannot bypass chosen policy; legitimate booking, full capacity, cancellation and concurrent attempts remain correct |
| Payment identity | Same reference across ticket/dues/order conflicts; same-source retry succeeds; different clubs remain independent; concurrent attempts cannot both post; legacy collisions surfaced without history loss |
| Availability | Expired final-seat hold is released on list/detail read; a still-live hold remains occupied |
| Task navigation | Direct event-task link filters correctly; changing event and clearing filter work; refresh/back preserve defined behavior |

Run the current repository's `npm run check` with root and client dependencies installed. Include schema snapshots and contract synchronization when changed. Check SQLite and disposable PostgreSQL for the payment uniqueness change. Record browser/device gaps honestly; passing a build is not visual acceptance.

### Deliberate exclusions

No payment gateway, email/WhatsApp provider, broad redesign, campus-wide rewrite or unrelated tooling changes. Existing honest simulation labels remain. No credentials, database files or real student records enter the PR.

### Delivery

Revalidate main, complete sequential autoplan CEO/design/DX-if-required/engineering reviews, implement with regression coverage, inspect the complete diff, commit and push the named branch, create the PR using the repository template, and attach it to this chat. The user has requested implementation and a PR; no additional routine scope approval is needed. Material changes to the requested behavior should be surfaced.

## Review record

The full autoplan CEO/design/DX/engineering pipeline did not complete. The initial snapshot preparation rejected the missing Review record section; this document now includes that section. Independent product, technical and UX jury audits preceded implementation. A focused independent technical review of the fixes found expense conflict-recovery issues, which were corrected before final verification.

### Current blockers

GitHub CLI could not read its saved configuration in the sandbox. The requested escalation failed because automatic approval review returned HTTP 404, deployment not found. Writing the attached checkout failed for the same reason. Neither action executed. Later, creating the delivery branch in the original checkout failed because another Git patch-application (`git am`) session is unfinished; that session was preserved. The autoplan bootstrap also reports missing shell utilities/state-root resolution. Code implementation and available checks are recorded separately; no commit, push or PR was created by this task.
