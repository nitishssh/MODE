# Contributing to MODE

Pick an assigned ticket from https://github.com/users/nitishssh/projects/14. The board is the implementation tracker; the repository issue contains acceptance criteria and dependencies.

```sh
git switch main
git pull --ff-only
git switch -c auth-roles
npm ci
npm ci --prefix client
npm run auth:setup
npm run dev
```

Use a descriptive branch name appropriate to your issue; do not use agent or provider names in branches or PR titles. Coordinate API changes in `docs/API.md`, keep changes focused, and include meaningful tests for business rules and failure cases.

Before opening a PR:

```sh
npm run check:all
```

Use Node 24. `check:all` runs the same sequence as GitHub Actions' `verify` job: product version consistency, root and Expo lint/types/tests, API documentation and shared client contract checks, generated schema verification, the Next.js production build and HTTP restart acceptance, then the Expo web export, delivery build and same-origin acceptance. Both dependency trees must be installed first. The script stops at the first failure and selects each build's `MODE_EXPO_WEB` value on Windows, macOS and Linux. Use `npm run check:all -- --list` to inspect the sequence.

This sequence clears inherited database URLs and receipt paths so its SQLite fixtures remain isolated. The separate `postgres` CI job runs `npm run test:postgres` against its own disposable PostgreSQL 17 service, with test files serialized. Both CI jobs must pass. For a local PostgreSQL run, follow [PostgreSQL testing](docs/POSTGRESQL.md) with a disposable database: `MODE_TEST_DATABASE_URL` causes tests to drop and recreate the public schema. Never point it at a deployment, shared development database, or the persistent local demo database.

`npm run check` remains a shorter backend loop: version consistency, lint, types, API documentation contracts, generated schema verification, tests and production build. `npm run test:foundation` requires that build and uses an isolated temporary database. See [foundation acceptance](docs/FOUNDATION.md) for browser checks and recorded results.

After changing a database migration, run `npm run schema:dump` and commit both generated files, `docs/schema.sql` and `docs/schema.postgres.sql`, with that migration. `npm run schema:check` verifies them without rewriting files. The generator uses an in-memory SQLite database and exports only schema definitions, never application records. Both `check` and `check:all` include this guard. PostgreSQL runtime migrations are exercised by the separate PostgreSQL tests.

For release changes, update the root `VERSION`, all seven manifest fields and `CHANGELOG.md` together. See [product versioning](docs/VERSIONING.md) for the checklist. `npm run check:version` works without installed dependencies and catches mismatched server, client, lockfile and Expo versions.

Root lint reuses the ESLint, React/hooks and TypeScript packages already locked in the client, while client lint retains its Expo configuration. Neither command permits warnings. `.editorconfig` sets whitespace conventions; the prepared Prettier configuration is not enforced yet because Prettier and the Next.js-specific ESLint packages are not installed. See [quality tooling](docs/QUALITY.md) for that follow-up. Do not manually edit generated client contracts: run `npm run sync:contracts` after server contract changes.

Tests generate their own throwaway `MODE_JWT_SECRET` (tests/setup-env.mjs); the local app needs the one `npm run auth:setup` writes to `.env.local`. See [quality checks](docs/CODE-QUALITY.md) for coverage, security scanning and dependency auditing.

Use `Closes #<issue>` only when the PR completes that issue. Move the board item to In review and describe the user-visible change, verification and remaining limitations. Nitish coordinates integration and release; every contributor should review and explain their own code.

Never commit `.env.local`, credentials, `.data/`, real member data, receipts or generated build output. The starter database is local synthetic demo data. Additional modules should use transactional updates and the authorization model from ticket #3.
