# MODE — Student Organization System

A runnable team starter for the Odoo x NMIT student organization problem: memberships, events, announcements, merchandise, volunteer work and club finances.

[Project board](https://github.com/users/nitishssh/projects/14) · [Implementation tickets](https://github.com/nitishssh/MODE/issues) · [Task map](docs/TASKS.md) · [Team ownership](docs/TEAM.md) · [API contracts](docs/API.md) · [Demo checklist](docs/DEMO.md) · [Agent instructions](AGENTS.md)

## Run locally

Use **Node.js 24 LTS**. Node 22.13+ within the 22.x line and Node 24+ are supported because the backend uses native `node:sqlite`; Node 23 is excluded. No external database, cloud credentials or email provider is required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The first API request creates `.data/mode.sqlite`, applies schema version 10 and inserts clearly fictional sample records once. Existing starter databases migrate in place. Authorized member creation persists across restarts.

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

- SDK 57 Expo shell in `client/`: cookie-based web login, SecureStore native bearer sessions, permission-driven navigation, membership pass details, task updates and treasury totals. See [the Expo walkthrough](docs/DEMO.md#expo-shell-and-same-origin-web).
- Optional same-origin Expo export at `/`, with the existing business workspace at `/legacy`. Full scanner, holds and native business screens remain work for #11–#13; bundle compilation does not establish physical-device acceptance.

- Responsive dashboard and navigation for all six club areas.
- Browser sign-in/sign-out, task editing, receipt-backed expenses, treasury review and ledger CSV export.
- Backend APIs for dues/renewals, simulated reminders, ticket holds, payment confirmation, check-in and merchandise orders with stock holds.
- SQLite-backed dashboard, health check and member directory.
- Registration, login, logout, hashed sessions and role-protected member APIs; native bearer tokens and browser HttpOnly cookies share the same session.
- Create a member through the authorized API with server validation and case-insensitive duplicate prevention.
- Server-calculated member/event counts and a sample ledger balance in integer paise.
- Fictional records showing how events, announcements, merchandise, volunteer work and finances will fit together.
- Tests, TypeScript and API contract checks, production build, automated server restart acceptance and GitHub Actions configuration.

## What the team will implement

The planned Expo client, membership and ticket screens, merchandise ordering screens and announcement mailing remain tracked in [the MVP tickets](https://github.com/nitishssh/MODE/milestone/1). Dues, ticket and merchandise backend APIs, editable web tasks and reimbursement approvals are implemented. Unfinished web flows remain previews. Payment confirmations record external payments; no gateway transfer or real email is performed.

The starter is a single-club, local development scaffold with synthetic demo accounts. The web UI has browser sign-in; the planned Expo client remains future work. Anonymous dashboard responses withhold the member directory and finance data. See [API contracts and demo accounts](docs/API.md) to exercise the authenticated endpoints. Hosted SQLite needs a persistent disk and one writable instance; a serverless ephemeral filesystem is not durable storage.

## Stack and layout

Next.js App Router · React · TypeScript · Zod · native SQLite · plain CSS.

```text
src/app/page.tsx          Sign-in, student workspace and member form
src/app/globals.css       Responsive design
src/app/api/              Auth, memberships, tickets, tasks, expenses and ledger
src/lib/contracts.ts     Shared API types
src/lib/database.ts      SQLite connection and module composition
src/lib/db/              Versioned schema migrations and transaction helpers
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

The web manifest provides the MODE icon and standalone display metadata. On a supported browser, use its install or Add to Home Screen action when available. Installation support depends on the browser and a secure context; plain HTTP on a LAN address may not qualify. There is no offline cache or service worker: the server must remain reachable. Physical-device installation has not been verified. The Expo client is still planned; `EXPO_PUBLIC_API_URL` is reserved for that future client.

### Authenticated tasks and reimbursements

The web workspace now has sign-in, a task board, personal expense submissions and treasury review. Task assignment and status changes respect the signed-in member’s permissions. Receipts are private to their uploader and club finance reviewers. Reimbursements post exactly once to the shared ledger, alongside dues and ticket income. Schema v9 preserves the existing dues and ticket data. See [API](docs/API.md) and [demo walkthrough](docs/DEMO.md).
