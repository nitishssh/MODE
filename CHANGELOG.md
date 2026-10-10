# Changelog

Versions describe the prepared source. A version is released only after its change is merged to main and its required checks pass; it does not by itself indicate a hosted deployment.

## [0.2.0] - Unreleased

### Added

- Browse tasks, expense claims and ledger entries in bounded pages, with search, filters and page size stored in the URL.
- Request paginated members, tasks, expenses and ledger entries through the v2 API while retaining existing v1 integrations and full CSV exports.
- Track one application version across the server, client and Expo configuration, with an automated consistency check.
- Generate current SQLite and PostgreSQL schema documentation from migrations and reject stale DDL in both local and CI verification commands.
- Diagnose API requests using correlation IDs and separate liveness and database readiness endpoints.
- Prepare a local Docker demo with persistent SQLite and receipt storage.

### Changed

- Calculate complete treasury totals using SQL aggregates and use indexed range queries for later result pages.
- Run root/client lint and a shared verification command in CI, plus a serialized disposable-PostgreSQL test job.
- Keep the public landing at `/` and Next sign-in at `/login` in both delivery modes; serve the authenticated overview at `/dashboard`.
- Add pagination indexes as migration 14 while preserving the version 13 schema hardening already on main.

### Fixed

- Preserve validated page destinations through login and registration, including special characters in search values.
- Keep selected events in page URLs and show explicit errors for inaccessible events or pages.
- Retain claim drafts during successful session revalidation and recover correctly after invalid filters or expired cursors.
- Preserve same-tab query history in the navigation state; live browser verification is still pending.

This preparation retains main's SQLite and PostgreSQL runtimes. Redis/cache design, remaining pilot workflows and 400-student capacity verification remain planned work. Actual PostgreSQL execution, the Docker image, browser navigation and hosted deployment require verification before a pilot launch.
