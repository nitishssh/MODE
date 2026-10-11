# Jury fixes: implementation and verification

Implemented locally on 11 October 2026 in the original MODE checkout. No commit, push or pull request was created by this task. Existing unrelated changes and an active `git am` session were preserved.

## Implemented behavior

- Admission scanning clears the previous attendee's decision before each request. Expo already cleared its previous result.
- Web and Expo reimbursement forms retain an immutable submission ID, receipt and payload after an ambiguous response. Retrying does not upload again. Conflicts reconcile against saved claims; a confirmed missing claim unlocks correction, while a failed lookup retains the attempt.
- Event creation/editing accepts a nonnegative safe integer fundraiser target in paise. The web form accepts rupees, shared contracts expose the target, and zero targets display as unset rather than on track. The existing database column is reused.
- Free guest tickets require an organizer with event-write permission. Members can still reserve their own free ticket, organizers can issue legitimate guest tickets, and paid guest bookings retain their existing flow.
- Dues, ticket and merchandise income reject reuse of an external transfer reference across sources within a club. Checks run in the existing write transaction, using SQLite's immediate lock and a shared club-row lock on PostgreSQL. Same-source replay is preserved. Existing financial history is not rewritten; this is an application-path guarantee, not a new database uniqueness constraint.
- Event list/detail reads release expired reservations before reporting capacity.
- Event-task links, filter changes, clearing, refresh and navigation use URL state.
- In this checkout's English workspace, the language selector is replaced with an explicit multilingual legacy link. Signed-in root visits route to `/app`. Logout failures are displayed rather than silently navigating away.

## Verification

| Check | Result |
| --- | --- |
| Final `npm run build` | Passed after all source changes |
| `node scripts/check-foundation.mjs` | Passed all 10 groups against the production build and an isolated SQLite database |
| Root and Expo lint | Passed; final changed web expense file also rechecked |
| Root type checking | Passed within the earlier quality run; final production build also passed TypeScript checking |
| Expo type checking | Passed after Expo changes |
| `node scripts/sync-contracts.mjs --check` | Passed |
| `git diff --check` | Passed |
| Full `npm run check` | Blocked during tsx-based contract-document check: `uv_os_get_passwd` returned `ENOMEM`; no full-suite pass is claimed |
| Browser/device acceptance | Not completed; browser access previously failed at automatic approval review |
| PostgreSQL concurrency | Transaction ordering independently reviewed; no live PostgreSQL race test completed |

HTTP regressions exercise cross-source conflicts in each income path, same-source replay across restart, exact expense replay with one retained receipt, changed-payload/duplicate-receipt conflicts and lookup, positive/zero/invalid fundraiser goals, member edit rejection, anonymous/member free guest rejection, authorized free guest issuance, full capacity, and live/expired holds on detail/list reads. The HTTP checks validate API behavior; they do not simulate dropped browser responses or prove visual scanner/filter behavior.

Build and HTTP logs are in `tmp/jury-fix-build-final.log` and `tmp/jury-fix-foundation-final.log`. Source copies taken before implementation are under `tmp/jury-baseline`; these are local aids, not release artifacts.

## Independent review

The initial product, technical and UX judges reported 76, 81 and 72 respectively; see [the original jury report](hackathon-jury-2026-10-11.md). These scores predate the fixes and have not been reassessed. A subsequent independent technical review identified expense conflict recovery and reconciliation-error handling issues; both were corrected. The reviewer confirmed the final reconciliation fix with no remaining findings in that focused review. The complete autoplan CEO/design/DX/engineering pipeline did not finish, so this report does not certify it.

## Publication handoff

Proposed branch: `fix/jury-workflow-reliability`.

Proposed title: `Fix admission, reimbursement and club finance workflows`.

The original checkout contains substantial pre-existing uncommitted work and is behind upstream. Creating the delivery branch failed because it is in the middle of `git am`. Do not stage the entire working tree or abort that session to publish these fixes. Once the existing Git operation is resolved, port only this task's changes onto current main and rerun checks. Upstream's newer translated workspace and homepage require reconciliation with the routing/language fixes made here.

GitHub CLI access and writes to the attached isolated checkout previously failed at automatic approval review with HTTP 404, deployment not found. Publication needs that approval service restored. No PR URL exists to attach.
