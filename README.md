# MODE — Student Organization System

A runnable team starter for the Odoo x NMIT student organization problem: memberships, events, announcements, merchandise, volunteer work and club finances.

[Project board](https://github.com/users/nitishssh/projects/14) · [Implementation tickets](https://github.com/nitishssh/MODE/issues) · [Task map](docs/TASKS.md) · [Team ownership](docs/TEAM.md) · [API contracts](docs/API.md) · [Demo checklist](docs/DEMO.md) · [Agent instructions](AGENTS.md)

## Run locally

Use **Node.js 24 LTS**. Node 22.13+ within the 22.x line and Node 24+ are supported because the backend uses native `node:sqlite`; Node 23 is excluded. No external database, cloud credentials or email provider is required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The first API request creates `.data/mode.sqlite`, applies schema version 4 and inserts clearly fictional sample records once. Adding a member persists to that database, including across restarts.

Optional configuration is documented in `.env.example`; copy it to `.env.local` if needed. Never commit `.env.local` or the local database. To try a separate dataset without changing the existing one, set `SQLITE_PATH` to a new filename.

```sh
npm run typecheck
npm test
npm run build
npm start
```

Writes now require signing in (see [API contracts](docs/API.md) for roles and demo accounts). `npm start` runs in production mode, which refuses to seed a new database with the public default demo password: set `MODE_DEMO_PASSWORD` first (for example `MODE_DEMO_PASSWORD=your-own-secret npm start`). Both provided server commands bind to loopback by default.

## LAN and PWA delivery

For a trusted, synthetic-data LAN demonstration, use `npm run dev:lan` during development or `npm run build` followed by `npm run start:lan` for the production server. These commands bind to `0.0.0.0`; ordinary `dev` and `start` remain loopback-only. Find the computer's Wi-Fi IPv4 address with `ipconfig` on Windows, then open `http://<wifi-ip>:3000` from another device on the same network. Allow Node.js through the private-network firewall if the connection is blocked. Do not use the LAN mode on untrusted networks.

The root web application is installable as a PWA when served over HTTPS (or localhost). Its manifest is exposed at `/manifest.webmanifest`; use Edge's **Apps → Install this site as an app** after opening the hosted/same-origin URL. The app deliberately does not install a service worker or cache API responses, so private financial/member data is never retained offline by this delivery layer.

MODE offers browser sign-in. It is not an Expo project and does not currently offer ticket check-in or a native client. See [docs/DEMO.md](docs/DEMO.md) for the exact supported demo and outstanding platform checks.

## What works today

- Responsive dashboard and navigation for all six club areas.
- Browser sign-in/sign-out and permission-aware member and treasury navigation.
- SQLite-backed dashboard, health check and member directory.
- Create a member with server validation and case-insensitive duplicate prevention.
- Server-calculated member/event counts and a sample ledger balance in integer paise.
- Task board with status, assignment, event, deadline, overdue and “assigned to me” filters.
- Receipt-backed volunteer expense submission, approval/rejection/payment workflow, treasury summaries and ledger CSV export.
- Event fundraiser and task progress reports sourced from the event report API.
- Mobile-friendly product catalogue and searchable announcement archive using the available server-backed dashboard data.
- Fictional records showing how events, announcements, merchandise, volunteer work and finances will fit together.
- Tests, TypeScript checks, production build and GitHub Actions configuration.

## What the team will implement

Membership dues/renewals, ticket sales and check-in, size-specific merchandise orders and announcement mailing remain tracked in [the MVP tickets](https://github.com/nitishssh/MODE/milestone/1). These unfinished flows remain starter previews. Authentication/RBAC, editable volunteer tasks and reimbursement approvals are implemented. No real payment or email has been processed; reimbursement payment records an external payment reference.

The starter uses a single-club synthetic demo dataset. Health and the limited dashboard API remain public; member-directory, task, expense, receipt and ledger APIs enforce session and permission checks as described in [the API contracts](docs/API.md). Hosted SQLite needs a persistent disk and one writable instance; a serverless ephemeral filesystem is not durable storage. Expense decisions require the appropriate signed-in role. Merchandise variants/orders and announcement publication/delivery remain blocked until their backend contracts are available.

## Stack and layout

Next.js App Router · React · TypeScript · Zod · native SQLite · plain CSS.

```text
src/app/page.tsx          Sign-in, student workspace and member form
src/app/globals.css       Responsive design
src/app/api/              Auth, dashboard, members, tasks, expenses and ledger
src/lib/contracts.ts     Shared API types
src/lib/database.ts      SQLite connection and module composition
src/lib/db/              Versioned schema migrations and transaction helpers
src/lib/modules/         Identity, dashboard, workspace and ledger persistence
src/lib/member-validation.ts
src/lib/mutation-guard.ts
tests/                   Persistence, domain and API checks
docs/                    Team, contracts, task map and demo
.github/workflows/ci.yml  Pull request and push checks
```

## Team

| Person | GitHub | Ownership |
|---|---|---|
| Nitish | [@nitishssh](https://github.com/nitishssh) | Architecture, integration, setup, CI, deployment and release |
| Divyank | [@DIVYANK-BHARDWAJ](https://github.com/DIVYANK-BHARDWAJ) | Backend, schema, business rules, auth and API tests |
| Azman | [@Azmanshaikh](https://github.com/Azmanshaikh) | Frontend, forms, dashboards, API consumption and responsive UX |

The 10 October plan assigns the former platform/release role to Nitish. Use one feature branch and one linked PR per ticket; every contributor should own and explain their work. See [CONTRIBUTING.md](CONTRIBUTING.md).
-Please check the detail docs (https://github.com/nitishssh/MODE/wiki)
