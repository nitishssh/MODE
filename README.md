# MODE — Student Organization System

A runnable team starter for the Odoo x NMIT student organization problem: memberships, events, announcements, merchandise, volunteer work and club finances.

## Historical codebase documentation

Start with the [historical codebase guide](docs/CODEBASE.md): architecture and feature status, [source files and shared types](docs/CODE-REFERENCE.md), [database tables and migrations](docs/DATA-MODEL.md), [HTTP APIs](docs/HTTP-API.md), and [setup, walkthroughs and testing](docs/DEVELOPMENT.md). These guides cover commit `a62c6e2` (10 October 2026), with pinned source links. That snapshot predates the Expo client and schema 12; its inventories and setup instructions do not describe current `main`. For current setup, use this README and the [client README](client/README.md).

[Project board](https://github.com/users/nitishssh/projects/14) · [Implementation tickets](https://github.com/nitishssh/MODE/issues) · [Task map](docs/TASKS.md) · [Team ownership](docs/TEAM.md) · [API contracts](docs/API.md) · [Demo checklist](docs/DEMO.md) · [Agent instructions](AGENTS.md)

## Run locally

Use **Node.js 24 LTS**. Node 22.13+ within the 22.x line and Node 24+ are supported because the backend uses native `node:sqlite`; Node 23 is excluded. No external database, cloud credentials or email provider is required. PostgreSQL is optional (`DATABASE_URL`).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The first API request creates `.data/mode.sqlite`, applies schema version 12 and inserts clearly fictional sample records once. Existing starter databases migrate in place. Authorized member creation persists across restarts.

Optional configuration is documented in `.env.example`; copy it to `.env.local` if needed. Never commit `.env.local` or the local database. To try a separate dataset without changing the existing one, set `SQLITE_PATH` to a new filename.

The repository's `.nvmrc` selects Node 24 for version managers that support it. To verify a fresh checkout, follow [the foundation acceptance check](docs/FOUNDATION.md), including the automated server restart test.

```sh
npm run check
npm run test:foundation
npm start
```

Member creation requires an organizer or admin session in both development and production (see [API contracts](docs/API.md)). `MODE_ENABLE_DEMO_WRITES` has been replaced by role-based authorization. `npm start` runs in production mode, which refuses to seed a new database with the public default demo password: set `MODE_DEMO_PASSWORD` in the environment first. Both provided server commands bind to loopback by default.

Native API clients can log in without browser Origin headers and use the returned `token` as `Authorization: Bearer <token>`. For development browser API access, optionally set `MODE_CORS_ORIGINS` to exact comma-separated origins in `.env.local`; this permits reads and bearer requests, while browser login and cookie mutations remain same-origin. Production ignores this allowlist. See [the CORS contract](docs/API.md#development-cors).

## What works today

- SDK 57 Expo client in `client/`: registration, cookie-based web login, SecureStore native bearer sessions, permission-driven navigation, QR membership passes and dues, event booking and check-in, merchandise, announcements, task assignment, receipt claims and treasury/source/CSV views. See [the interactive journey](docs/DEMO.md#interactive-client-journey).
- Optional same-origin Expo export at `/`, with the existing business workspace at `/legacy`. Native camera scanning, receipt selection and private-file sharing are implemented; bundle compilation does not establish physical-device acceptance.
- Responsive dashboard and navigation for all six club areas.
- Legacy web interface in English and eleven of the most spoken Indian languages (Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Malayalam, Punjabi, Assamese), chosen from the browser's language or the in-app switcher.
- Browser sign-in/sign-out, task editing, receipt-backed expenses, treasury review and ledger CSV export.
- Backend APIs for dues/renewals, simulated reminders, ticket holds, payment confirmation, check-in and merchandise orders with stock holds.
- Announcement publication API with a public dated archive, active-member notifications, atomic simulated outbox delivery and safe retries. See the [announcement demo](docs/DEMO.md#announcement-publication-8).
- SQLite-backed dashboard, health check and member directory.
- Registration, login, logout, hashed sessions and role-protected member APIs; native bearer tokens and browser HttpOnly cookies share the same session.
- Create a member through the authorized API with server validation and case-insensitive duplicate prevention.
- Server-calculated member/event counts and a sample ledger balance in integer paise.
- Fictional records showing how events, announcements, merchandise, volunteer work and finances will fit together.
- Tests, TypeScript and API contract checks, production build, automated server restart acceptance and GitHub Actions configuration.

## Remaining acceptance

Physical Android/iOS camera, picker, haptics and sharing, LAN journeys and installed Windows PWA behavior remain tracked in [the MVP tickets](https://github.com/nitishssh/MODE/milestone/1). Selected local browser journeys and automated API/restart checks are recorded in [the demo guide](docs/DEMO.md#interactive-client-journey); they do not complete every native/web acceptance criterion. Payment confirmations record external payments; no gateway transfer or real email is performed.

The starter is a single-club, local development scaffold with synthetic demo accounts. The web and Expo client have sign-in and business screens; physical-device acceptance remains outstanding. Anonymous dashboard responses withhold the member directory and finance data. See [API contracts and demo accounts](docs/API.md) to exercise the authenticated endpoints. Hosted SQLite needs a persistent disk and one writable instance; a serverless ephemeral filesystem is not durable storage. Set `DATABASE_URL=postgres://…` to run the same application on PostgreSQL instead (`npm run postgres:up` starts a local server, `npm run postgres:push` moves an existing SQLite database across); see [docs/POSTGRESQL.md](docs/POSTGRESQL.md). Known schema and workflow gaps are tracked in [docs/DB-AUDIT.md](docs/DB-AUDIT.md).

## Stack and layout

Next.js App Router API · Expo Router · React Native Web · React · TypeScript · Zod · native SQLite.

```text
client/src/app/          Expo registration, booking and authenticated business screens
src/app/page.tsx          Existing web entry (Expo export is optional)
src/app/legacy/page.tsx   Existing web workspace
src/app/globals.css       Responsive design, script fallbacks and right-to-left layout
src/app/api/              Auth, memberships, tickets, tasks, expenses and ledger
src/i18n/                 Locale registry, dictionaries (12 languages), formatters and provider
src/lib/contracts.ts     Shared API types
src/lib/database.ts      SQLite connection and module composition
src/lib/db/              Versioned schema migrations and transaction helpers
docs/schema.sql          Generated DDL for the current schema (`npm run schema:dump`)
docs/schema.postgres.sql Generated PostgreSQL translation of the same schema (`npm run schema:dump`)
src/lib/modules/         Identity, dues, events, workspace and ledger persistence
src/lib/member-validation.ts
src/lib/mutation-guard.ts
tests/                   Persistence, domain and API checks
docs/                    Team, contracts, task map and demo
.github/workflows/ci.yml  Pull request and push checks
```

## Team

| Person | GitHub | Ownership |
|---|---|---|
| Nitish | [@nitishssh](https://github.com/nitishssh) | Integration, announcements, volunteers, reimbursements, scaffold support and release |
| Divyank | [@DIVYANK-BHARDWAJ](https://github.com/DIVYANK-BHARDWAJ) | Shared backend foundation, auth, memberships, tickets, merchandise and module tests |
| Azman | [@Azmanshaikh](https://github.com/Azmanshaikh) | Expo frontend, Member Pass, scanner, forms and treasurer screens |

The 10 October plan assigns the former platform/release role to Nitish. Use one feature branch and one linked PR per ticket; every contributor should own and explain their work. See [CONTRIBUTING.md](CONTRIBUTING.md).
-Please check the detail docs (https://github.com/nitishssh/MODE/wiki)

## LAN and home-screen access

Run `npm run dev:lan` to listen on all network interfaces, then open `http://<computer-LAN-IP>:3000` from a device on the same network. Permit the server through your private-network firewall if needed. Sign in on that same origin; the web workspace uses relative API URLs and does not need a CORS allowlist. Use only synthetic data and a private network for a plain-HTTP demo.

For a production-mode LAN demo, build first, configure `MODE_DEMO_PASSWORD` before the first database seed, and run `npm run start:lan`. Persist the database and its adjacent receipts directory together. A hosted installation needs HTTPS and persistent storage.

The web manifest provides the MODE icon and standalone display metadata. On a supported browser, use its install or Add to Home Screen action when available. Installation support depends on the browser and a secure context; plain HTTP on a LAN address may not qualify. There is no offline cache or service worker: the server must remain reachable. Physical-device installation has not been verified. The Expo shell is in `client/`; native devices use `EXPO_PUBLIC_API_URL` to reach this server.

### Authenticated tasks and reimbursements

The web workspace now has sign-in, a task board, personal expense submissions and treasury review. Task assignment and status changes respect the signed-in member’s permissions. New claims require a JPG, PNG or PDF receipt up to 5 MB, private to their uploader and club finance reviewers. Reimbursements post exactly once to the shared ledger, alongside dues and ticket income. The register links to exact source records and shows the paying officer; its CSV export matches the register totals. Schema v12 preserves older workflow and ledger records alongside the released receipt and announcement migrations. See [API](docs/API.md), [demo walkthrough](docs/DEMO.md) and [local reimbursement verification](docs/REIMBURSEMENT-VERIFICATION.md).

## Languages

The legacy web workspace is available in English and eleven of the most spoken scheduled languages of India: Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Malayalam, Punjabi and Assamese. The language is chosen once per request by one rule: a valid `mode_lang` cookie wins, otherwise the browser's `Accept-Language` header, otherwise English. The switcher in the top bar (and on the sign-in screen) writes that cookie and re-renders the server tree, so `<html lang>` and `dir` are always correct and Urdu renders right-to-left.

Dictionaries live in `src/i18n/dictionaries/<code>.ts`; English is the master and the `Dictionary` type plus `tests/i18n.test.ts` force every language to carry the same keys and placeholders. Only the requested language is loaded, on the server, so other languages are not bundled into the client (the selected dictionary is sent to the browser). Amounts and dates use `Intl` with the matching `*-IN` locale and Latin digits in every language, so figures on screen always match the ledger and the CSV export. API error messages are mapped by their `code` to the active language; the API itself stays English.

The Expo client and guest ticket HTML currently use English labels; the legacy language switcher does not translate those surfaces.

To add a language: append it to `LOCALES` in `src/i18n/locales.ts`, add `src/i18n/dictionaries/<code>.ts` typed as `Dictionary`, and register it in `src/i18n/dictionaries/index.ts`. The test suite fails until every key is translated.
