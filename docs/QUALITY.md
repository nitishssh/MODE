# Quality tooling

Install both dependency trees with `npm ci` and `npm ci --prefix client`, then run `npm run check:all`. GitHub Actions' `verify` job uses this same command on pushes and pull requests, with Node 24 and npm caches keyed by both lockfiles. `npm run check:all -- --list` prints the 15 ordered checks without running them.

The runner stops at the first failure, starting with the [product version consistency check](VERSIONING.md). It clears inherited `DATABASE_URL`, `MODE_TEST_DATABASE_URL` and `MODE_RECEIPTS_DIR` for its subprocesses. It explicitly builds the standard Next.js app before the isolated HTTP/restart check, then exports the Expo app, rebuilds with `MODE_EXPO_WEB=1` and checks same-origin delivery. The HTTP scripts create their own temporary databases and stop their servers. The final `.next` build supports Expo delivery; run `npm run build` again when a standard web build is needed.

Both `check` and `check:all` include `schema:check`, which compares [schema.sql](schema.sql) and [schema.postgres.sql](schema.postgres.sql) with DDL generated from current migrations in an in-memory SQLite database. A stale or missing file fails the check without rewriting it. Regenerate both with `npm run schema:dump` and commit them alongside migration changes. The dumps contain no seed or application records.

## PostgreSQL CI

The independent `postgres` job starts a fresh PostgreSQL 17 service and runs `npm run test:postgres`. Its literal `MODE_TEST_DATABASE_URL` points only at that job's local `mode_test` database; it uses no deployment credentials or persistent volume. Tests serialize their files because helper-based tests reset the same public schema. The service disappears when the job ends. Both `verify` and `postgres` must pass before merge.

For local execution, use only a disposable database and set `MODE_TEST_DATABASE_URL` explicitly as described in [PostgreSQL](POSTGRESQL.md). Tests drop and recreate its schema. `DATABASE_URL` selects the application database and must not be repurposed as the test target. The workflow definition and generated DDL do not prove a successful PostgreSQL test run; record the actual CI result before merging.

## Lint coverage

`npm run lint` checks root application code, scripts and tests with a flat config. It uses `createRequire` scoped to `client/package.json` to load the existing locked Expo ESLint stack and TypeScript recommended rules. This supplies React, Hooks, imports and TypeScript checks without installing a second copy of the toolchain. `npm run lint:client` keeps Expo's own lint command and config. Both commands fail on warnings.

Generated build output and the client are ignored by the root config; the client is checked separately. A Next.js build no longer runs lint automatically in Next 16, so the explicit lint steps are required.

One existing rule debt is scoped to `src/components/legacy-workspace.tsx` and `src/app/not-found.tsx`: `react-hooks/set-state-in-effect` is temporarily disabled only for these two files. The legacy workspace starts task, expense, treasury and event-report loaders in effects; the not-found page restores a stored theme in an effect. A future screen refactor should move these synchronous state transitions out of effects and remove the exception. All other Hooks and lint rules remain enabled, and new files receive the full rule set.

## Pending formatter and Next.js-specific rules

`.editorconfig`, `.prettierrc.json` and `.prettierignore` prepare consistent formatting, but **Prettier checks and the Next.js Core Web Vitals rules are not enabled yet**. Adding the packages was blocked by registry access during implementation, so no dependency or lockfile entries were fabricated. The current verification command works with the existing lockfiles.

To complete this follow-up when dependency downloads are available:

1. Install root development packages with `npm install --save-dev eslint@^9 eslint-config-next@16.4.0 eslint-config-prettier@^10 prettier@^3` and commit the npm-generated lockfile.
2. Replace the temporary shared Expo root config with the flat config below. Keep the client config separate and preserve the root's existing generated-output ignores.
3. Change root `lint` to `eslint . --max-warnings=0`, add `format:check` as `prettier . --check`, and add it to `scripts/check-all.mjs`.
4. Run the formatter on reviewed source files, resolve the initial formatting findings, and verify the full command before making formatting mandatory in CI.

The installed Next 16.4 guide at `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md` documents this setup:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "client/**",
    "public/expo/**",
    "tmp/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
```
