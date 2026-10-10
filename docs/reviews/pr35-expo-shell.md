# PR #35 review and Expo shell implementation

Reviewed 10 October 2026. PR: https://github.com/nitishssh/MODE/pull/35

Reviewed Azman's head `c598b3a0b854c260a722ca266d3c1de25e0b4aab`, then merged current main `a62c6e27724eccfafe54f3d85c9ddf066fb7c033` into `expo-shell-completion`. The integrated candidate retains main's reimbursement and announcement work. No merge or issue closure is implied by this report.

## Findings repaired

| Severity | Finding in PR #35 | Repair and evidence |
|---|---|---|
| P1 | Volunteers could update any same-club task, contrary to the assigned-member contract. | Server permits only the assignee or `tasks:write`; both clients derive actions from that rule. Workspace regression tests cover unrelated and unassigned tasks. |
| P2 | Failed dashboard task writes could silently disappear behind a successful reload. | Keep an error on the affected row and apply status only after server confirmation. |
| P2 | Delayed completion could overwrite a later task action. | Remove delayed mutations; serialize pending writes per task. |
| P1 | Historical workflow-v2 databases lack `tasks.assignee`, breaking current task inserts/updates. | Version 12 adds/populates the compatible field after the released v10/v11 migrations; historical-fixture creation and reassignment tests pass. |
| P2 | Historical receipts require `uploader_name`, but current inserts omitted it. | Preserve/add the column and write the actor's name. Old bytes/references and new uploads are tested. |
| P1 | Paid historical expenses remained in the old ledger table, understating current outflows. | Import with source identity, date and event, avoid duplicated seed income, retain unknown payer attribution honestly, and abort ambiguous migrations. Reopen and reconciliation tests pass. |

A follow-up adversarial review found a P2 race in the new client: an old logout could overwrite a newer login after a concurrent 401. Generation checks and serialized secure-storage operations repair it. A deferred-response regression reproduces the original sequence and now passes; a focused independent recheck found no remaining issue in that repair.

## Issue #10 work added

- SDK 57 `client/` package with Expo Router, React Native Web and one standard Tabs renderer (left at 900px+, bottom below).
- Thinking Ledger light/dark colors, Literata, Anek Latin/Devanagari, JetBrains Mono, flat register rows, margin rules, hairline loading states and cached timestamps. Only the five used font weights are exported.
- Separate session/API and native/web token-store implementations: native SecureStore bearer, web same-origin HttpOnly cookie, no refresh-token protocol or browser token persistence. Resume revalidates identity and permissions.
- Login/logout, permission-protected routes, pass details, task status updates and treasury totals. Full scanner/holds/business-screen work remains with #11–#13.
- Generated server contracts and CI drift/type/lint/test/export checks.
- Opt-in Next hosting of the exported SPA at `/`, preserving `/api`, guest `/t/{token}`, and `/legacy`. Manifest plus 192/512 PNG icons. Missing export fails explicitly when enabled.
- Reproducible setup and acceptance steps in `docs/DEMO.md` and `client/README.md`.

## Verification

- Backend: 79 tests pass, including current-main announcement/reimbursement checks, real legacy schema fixtures and ledger reconciliation.
- Client: 10 tests pass, covering cookie/bearer separation, restoration, 401/403, failed logout, stale responses, permissions and invalid native API origins.
- Root/client TypeScript, client ESLint, contract documentation and generated-contract drift checks pass.
- Expo web export and Next production build pass. Android and iOS Hermes bundle exports pass; these are compilation checks, not device execution.
- `test:expo-web` passes against a temporary production server/database: deep links, bundle assets, API/guest exclusions, PWA icons, HttpOnly cookie login and logout revocation.
- `test:foundation` passes, including persistence across a real server restart.
- Local browser: admin sign-in, saved task change and reload, sign-out, member sign-in, absent Treasury tab, denied direct Treasury navigation, no unassigned-task action for members, phone tab layout and legacy workspace verified using synthetic accounts/data.
- `git diff --check` passes.

## Remaining acceptance and review limits

Physical Android/iOS Expo Go runs, installed Windows PWA behavior, deployed HTTPS/LAN delivery and the final business flows have not been verified. #10 must remain open until its actual device/merged acceptance criteria are met. This is local implementation evidence, not remote CI or a deployment result.

The plan-only workflow was superseded by the user's instruction to implement the remaining work. The installed review logger could not capture a working-tree fingerprint on this host, so no formal cleared skill-dashboard entry is claimed. Native adversarial review supplied the findings above; the broad final rerun encountered a provider rate limit, followed by a successful focused race-fix recheck. Optional outside-provider review was not completed.
