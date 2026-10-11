# Readiness authentication repairs — 11 October 2026

Prepared from local main commit `deb1438c74641f60ea2931362d97a0904843f76e`. The intended branch is `fix/readiness-gaps`.

## Changes

- Added `MODE_PUBLIC_ORIGIN` for an exact configured browser origin behind HTTPS termination. Cookie security and same-origin validation use the same configuration. Forwarded headers cannot add allowed origins, malformed configuration fails closed, and native requests without Origin retain their existing behavior.
- Fixed unknown-account login skipping its dummy password derivation. Existing account throttling is preserved.
- Reject the public demo password when explicitly configured in production, and check persisted synthetic-account password hashes whenever the production database is opened. Previously seeded databases cannot bypass this by changing the environment or skipping migrations.
- Documented configuration and the private maintenance process for rotating existing synthetic credentials. Production real-club initialization with `MODE_SEED=none` remains supported.

No schema migration or client contract change is required. The demo guard checks the six stable synthetic account IDs, not arbitrary member password strength. The application opens its database lazily, so unsafe persisted credentials reject that open operation rather than preventing the HTTP server process from listening.

## Regression evidence

`tests/readiness-auth.test.ts` adds eight cases: proxy login/logout, spoofing rejection, invalid configuration, dummy derivation invocation, explicit default rejection, promoted database rejection, safe production initialization, and successful rotation of existing credentials.

Before the repairs, five of the initial seven cases failed against the saved baseline. After repair, **44 focused checks passed** across the new tests, auth, auth follow-ups, member routes, CORS, database hardening and real-club initialization. TypeScript validation and the Next.js 16.4 Turbopack production build passed.

The standard tsx runner could not initialize in the restricted Windows session because `os.userInfo()` failed with `uv_os_get_passwd / ENOMEM`. The tests were transpiled with the installed TypeScript compiler and run with Node's test runner; the same source assertions and application modules were exercised. Generated JavaScript and logs are retained outside the source snapshot. A full npm check and live PostgreSQL execution are not claimed.

The isolated snapshot shares the existing node_modules through a junction. For the successful production build only, Turbopack's filesystem root was temporarily set to the containing authorized workspace, so it could resolve that dependency junction; next.config.ts was then restored byte-for-byte and is absent from the patch. A prior webpack fallback compiled application code but rejected the existing optional route-context signature in generated types. The normal Turbopack build passed without changing that route helper.

## Integration status

The changes were applied on `fix/readiness-gaps` in a clean worktree from `deb1438`. On that branch, with dependencies installed by `npm ci`, the standard runner passed: `npm run typecheck`, `check:contracts`, `schema:check`, `npm test` (124 tests, 123 passed, 1 skipped, 0 failed) and `npm run build`. Live PostgreSQL execution is still not claimed.

## Remaining audit scope

Current code already contains admin password-reset revocation, self-service password change, account throttling, cancelled-event admission checks, expiry cleanup and a one-live-claim-per-receipt constraint. Those were preserved.

Dashboard publication filtering, retry-safe merchandise creation and complete current client/release acceptance still need their own review and repair. The previous audit's feature matrix describes an older commit and should not be reused as a current completion checklist.
