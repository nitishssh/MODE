# Code quality and CI

Use Node 24 (`.nvmrc`) and install both dependency trees with `npm ci` and
`npm ci --prefix client`. GitHub Actions uses the same lockfiles and Node version.

## Local checks

| Command | Checks |
| --- | --- |
| `npm run lint` | Next.js Core Web Vitals, React/Hooks and recommended TypeScript rules for backend/web code, tests and scripts |
| `npm run lint:client` | Expo lint rules for the client and its tests |
| `npm run quality` | Both lint and TypeScript checks, API documentation, generated client contracts and SQLite/PostgreSQL schema drift |
| `npm run check` | All static checks, backend and client tests, and a Next.js production build |
| `npm run test:coverage` | Backend tests with V8 coverage, terminal summary and `coverage/lcov.info` |
| `npm run test:foundation` | Built-server API journey and persistence across restart |
| `npm run audit:dependencies` | Production dependencies from both lockfiles; fails on high/critical advisories or audit service errors |
| `npm run lint:fix` | Apply ESLint's available fixes to backend/web files |
| `npm --prefix client run lint:fix` | Apply ESLint's available fixes to client files |

Both linters fail on warnings and unused disable comments. Generated client
contracts are excluded from lint and checked against their source instead.
Builds, coverage, local databases and temporary output are excluded from lint.
EditorConfig provides shared indentation, line endings and final-newline settings;
it is editor guidance, not a CI formatting check.

Rule exceptions are documented where they apply: both clients retain their
effect-based loading/browser-state pattern; CommonJS preload scripts may use
`require`; App Router root fonts are not page-specific fonts. Full document links
crossing into the optional Expo export and generated QR/canvas images have local
exceptions. Other React/Hooks checks remain enabled.

Coverage is a report, not a percentage gate. It measures executed backend/web
source during the backend tests; it does not establish UI or native-device
coverage, and files never loaded by the tests may be absent. Review the report
and add meaningful regression tests when business behavior changes.

## CI jobs

See [the current dependency audit status](DEPENDENCY-SECURITY.md) for unresolved
Expo advisories and safe remediation requirements. An installed dependency
tree does not imply that its security audit passes.

The `Quality checks` workflow runs on pull requests, pushes to `main`, merge
queues and manual dispatches. Superseded runs for the same ref are cancelled.
Each job has a timeout and read-only repository permissions.

- **Lint, types and contracts** runs `npm run quality`.
- **Backend tests and production acceptance** runs coverage, uploads the LCOV
  report (14-day retention), builds Next.js and verifies restart persistence.
- **Client tests and web delivery** runs client tests, exports Expo, builds
  Next.js with `MODE_EXPO_WEB=1`, and verifies deep links, assets and cookie auth.
- **PostgreSQL integration** supplies an isolated PostgreSQL 17 service and runs
  the serial backend suite with `MODE_TEST_DATABASE_URL`, so the database journey
  cannot silently skip for lack of a connection string. Its credentials are
  disposable CI fixture credentials.
- **Production dependency audit** checks both lockfiles without running install
  scripts. Review fixes rather than using `npm audit fix --force` blindly.
- **Quality gate** succeeds only when all five jobs succeed. Failure,
  cancellation or a skipped prerequisite cannot produce a green gate.

The separate **Code security** workflow analyzes JavaScript/TypeScript with
CodeQL on pull requests, merge queues, pushes to `main` and weekly, and uploads findings to
GitHub code scanning. CodeQL requires code scanning availability for the
repository (public repositories, or the appropriate private-repository security
license). An upload succeeding does not mean there are no findings: configure
a code-scanning ruleset to block selected severities.

Dependabot proposes weekly updates for root npm packages, Expo packages and
GitHub Actions. Updates are reviewed and tested; they are not automatically
merged. Keep Next.js and `eslint-config-next` versions aligned and follow Expo's
SDK compatibility guidance when updating client dependencies.

The installed React and import lint plugins currently declare ESLint 9 peer
support, so both lint commands use that major. npm reports its end-of-support
warning during installation. Upgrade ESLint and those plugins together once
compatible versions are available; do not bypass peer checks to hide the warning.

## Merge and deployment gating

In the GitHub ruleset for `main`, require the **Quality gate** status check and
pull-request review. This repository configuration cannot itself enable branch
protection. Configure a code-scanning ruleset as well when CodeQL findings should
block a merge.

No deployment provider is configured in this repository. A deployment job added
to this workflow should declare `needs: verify` and run only after a successful
push to `main`; never use `always()` to deploy after a failed gate. External
hosting integrations must also wait for this check before promoting a commit.
Configure deployment credentials through environment secrets, not workflow files.

Production acceptance scripts create isolated temporary data and their own JWT
keys. They do not require a real deployment signing key. Do not use live club
data or production databases for CI.
