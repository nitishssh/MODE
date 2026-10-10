# MODE — Student Organization System

A runnable team starter for the Odoo x NMIT student organization problem: memberships, events, announcements, merchandise, volunteer work and club finances.

[Project board](https://github.com/users/nitishssh/projects/14) · [Implementation tickets](https://github.com/nitishssh/MODE/issues) · [Team ownership](docs/TEAM.md) · [API contracts](docs/API.md) · [Demo checklist](docs/DEMO.md)

## Run locally

Use **Node.js 24 LTS**. Node 22.13+ within the 22.x line and Node 24+ are supported because the backend uses native `node:sqlite`; Node 23 is excluded. No external database, cloud credentials or email provider is required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The first API request creates `.data/mode.sqlite`, applies schema version 3 and inserts clearly fictional sample records once. Existing starter databases migrate in place. Authorized member creation persists across restarts.

Optional configuration is documented in `.env.example`; copy it to `.env.local` if needed. Never commit `.env.local` or the local database. To try a separate dataset without changing the existing one, set `SQLITE_PATH` to a new filename.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Member creation requires an organizer or admin session in both development and production (see [API contracts](docs/API.md)). `MODE_ENABLE_DEMO_WRITES` has been replaced by role-based authorization. `npm start` runs in production mode, which refuses to seed a new database with the public default demo password: set `MODE_DEMO_PASSWORD` in the environment first. Both provided server commands bind to loopback by default.

Native API clients can log in without browser Origin headers and use the returned `token` as `Authorization: Bearer <token>`. For development browser API access, optionally set `MODE_CORS_ORIGINS` to exact comma-separated origins in `.env.local`; this permits reads and bearer requests, while browser login and cookie mutations remain same-origin. Production ignores this allowlist. See [the CORS contract](docs/API.md#development-cors).

## What works today

- Responsive dashboard and navigation for all six club areas.
- SQLite-backed dashboard, health check and member directory.
- Registration, login, logout, hashed sessions and role-protected member APIs; native bearer tokens and browser HttpOnly cookies share the same session.
- Create a member through the authorized API with server validation and case-insensitive duplicate prevention.
- Server-calculated member/event counts and a sample ledger balance in integer paise.
- Fictional records showing how events, announcements, merchandise, volunteer work and finances will fit together.
- Tests, TypeScript checks, production build and GitHub Actions configuration.

## What the team will implement

Membership dues/renewals, ticket sales and check-in, size-specific merchandise orders, announcement mailing, editable volunteer tasks and reimbursement approvals are tracked in [the MVP tickets](https://github.com/nitishssh/MODE/milestone/1). Those screens are explicitly read-only starter previews today. No real payment or email has been processed.

The starter is a single-club, local development scaffold with synthetic demo accounts. The auth backend is integrated on the foundation branch; the existing web UI has no sign-in flow yet and will be replaced by the planned Expo client. Anonymous dashboard responses withhold the member directory and finance data. See [API contracts and demo accounts](docs/API.md) to exercise the authenticated endpoints. Hosted SQLite needs a persistent disk and one writable instance; a serverless ephemeral filesystem is not durable storage.

## Stack and layout

Next.js App Router · React · TypeScript · Zod · native SQLite · plain CSS.

```text
src/app/page.tsx          Student workspace and member form
src/app/globals.css       Responsive design
src/app/api/              Health, dashboard and member endpoints
src/lib/contracts.ts     Shared API types
src/lib/database.ts      SQLite schema, seed and persistence
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

### Authenticated tasks and reimbursements

The web workspace now has sign-in, a task board, personal expense submissions and treasury review. Task assignment and status changes respect the signed-in member’s permissions. Receipts are private to their uploader and club finance reviewers. Reimbursements post exactly once to the shared ledger, alongside dues and ticket income. Schema v7 preserves the existing dues and ticket data. See [API](docs/API.md) and [demo walkthrough](docs/DEMO.md).
