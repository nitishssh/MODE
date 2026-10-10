# MODE code and file reference

Source snapshot: `a62c6e27724eccfafe54f3d85c9ddf066fb7c033` on pushed `main`, 10 October 2026. This inventory includes all **126 tracked files**, excluding generated dependencies/build output and these newly written docs. Links pin the actual source commit rather than relying on the older local checkout.

Read the [architecture](CODEBASE.md), [HTTP API](HTTP-API.md), [database](DATA-MODEL.md) and [development guide](DEVELOPMENT.md) for behavior and examples.

## Module composition and callable surface

`openClubDatabase(filename, options)` accepts an optional clock and receipts directory, returns `ClubDatabase` and supports `:memory:` for tests. `getDatabase()` is the application singleton. Store methods combine these groups:

| Surface | Main operations |
|---|---|
| Direct identity methods | `getMembers`, `findMember`, `requireMember`, `createMemberAs`, `register`, `login`, `logout`, `getActor`, `getPass`, `findMemberByPass`, `setRole`, `setPassword`, `recordAudit`, `listAudit` |
| Internal identity/tooling helpers | `createMember`, `createMemberWithCredentials`, `createClub`; no corresponding public club/tooling routes |
| Dashboard | `getDashboard(actor?)` |
| `dues` | `duesAmount`, `recordDues`, `paymentsFor`, `expiringWithin`, `sendRenewalReminders`, `notificationsFor`, `simulatedOutbox`, `nextExpiry` |
| `events` | List/get/create/update events; book member/guest tickets; expire holds; confirm/cancel; own/officer ticket lists; public ticket lookup; scan; report |
| `merchandise` | List/get/create/activate products, stock edits, create/confirm/cancel/fulfil orders, expire holds, own/officer order lists |
| `announcements` | `listPublished`, `getPublished`, `publish`, `inspectOutbox` |
| Direct workspace methods | Task CRUD/status; receipt save/access; expense list/submit/approve/reject/pay; actor-scoped ledger entries/source/summary and event report |
| `ledger` | Internal `post`, `list`, `balance`, `reconcile`; unlike HTTP treasury methods, list/balance/reconcile are database-wide helpers |
| Lifecycle | `transaction(fn)`, `health()`, idempotent `close()` |

Types and exact implementations are linked in the inventory. A method existing on the store does not imply a public HTTP endpoint. API writes derive actors from sessions; unguarded tooling helpers are for trusted server/test use.

## Web components

All main workspace components live in `src/app/page.tsx` at this snapshot.

| Component | Responsibility |
|---|---|
| `Home` | Initial session lookup, sign-in/sign-out and authenticated workspace mount |
| `Workspace` | Dashboard loading/refresh, selected section, member form, archive search, theme and mobile navigation |
| `TaskBoard` | Task filters, creation and status updates; permission-aware controls |
| `TaskCard` | Individual task display and edit form with nullable assignments/event/deadline |
| `MyExpenses` | Personal claim list, receipt upload, amount conversion and submission feedback |
| `Treasury` | Summary/expense/register tabs, approve/reject/pay controls, payment reference dialog, source inspection and CSV download |
| `EventReportCard` | Fetches combined ticket/fundraiser/task report for a selected event |
| `MemberTable` | Directory rows, dues and expiry information |
| `Icon`, `Empty`, `PreviewNote`, `Metric`, `PanelHeading` | Reusable SVG, empty state, unfinished-flow notice, metric and panel display helpers |
| `WorkspaceMainSkeleton`, `WorkspaceShellSkeleton` | Main content/full shell loading placeholders in `skeleton.tsx` |
| `NotFound` | Theme-aware 404 navigation in `not-found.tsx` |

## Complete file inventory

### Project, configuration and existing documentation

| File | Purpose |
|---|---|
| [.env.example](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/.env.example) | Commented configuration examples; no real service credentials required. |
| [.github/pull_request_template.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/.github/pull_request_template.md) | Contributor PR description/checklist template. |
| [.github/workflows/ci.yml](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/.github/workflows/ci.yml) | Ubuntu/Node 24 quality workflow: install, typecheck, contract docs, tests, build and real-server restart check. |
| [.gitignore](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/.gitignore) | Excludes dependencies/build artifacts and local environment/data paths from Git. |
| [.nvmrc](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/.nvmrc) | Node version-manager selection: 24. |
| [AGENTS.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/AGENTS.md) | Next.js-specific agent guidance to read bundled version documentation before code changes. |
| [CONTRIBUTING.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/CONTRIBUTING.md) | Contribution and integration workflow for the team. |
| [README.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/README.md) | Project overview, quick start, implemented versus planned scope and LAN instructions. |
| [TODOS.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/TODOS.md) | Deferred external notification dispatch and announcement client screens. |
| [docs/ACCEPTANCE.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/ACCEPTANCE.md) | Existing module acceptance and integration evidence/status. |
| [docs/API.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/API.md) | Existing detailed team-maintained HTTP contracts; some older prose remains historical. |
| [docs/DEMO.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/DEMO.md) | Existing demo checklist and feature walkthroughs. |
| [docs/FOUNDATION.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/FOUNDATION.md) | Foundation setup/quality/persistence verification instructions. |
| [docs/REIMBURSEMENT-VERIFICATION.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/REIMBURSEMENT-VERIFICATION.md) | Recorded local reimbursement verification evidence. |
| [docs/TASKS.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/TASKS.md) | Issue/task map and implementation ownership/status. |
| [docs/TEAM.md](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/docs/TEAM.md) | Team ownership and collaboration notes. |
| [next-env.d.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/next-env.d.ts) | Next.js TypeScript environment declarations; generated by framework tooling. |
| [next.config.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/next.config.ts) | Disables powered-by header, enables React Strict Mode and sets Turbopack root to process.cwd(). |
| [package-lock.json](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/package-lock.json) | Exact npm dependency resolution used by npm ci. |
| [package.json](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/package.json) | Pinned app dependencies, Node engine range and development/build/quality scripts. |
| [tsconfig.json](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tsconfig.json) | Strict TypeScript configuration, Next plugin, bundler resolution and @/* source alias. |

### Web UI and public assets

| File | Purpose |
|---|---|
| [public/mode-icon.svg](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/public/mode-icon.svg) | Vector app identity icon used by the manifest. |
| [src/app/globals.css](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/globals.css) | Base layout, paper-theme overrides, dark theme, mobile navigation, forms, tables, skeleton and 404 styles. |
| [src/app/layout.tsx](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/layout.tsx) | Root HTML layout, title/description metadata, global CSS and Google Fonts stylesheets. |
| [src/app/loading.tsx](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/loading.tsx) | Next.js loading boundary that renders WorkspaceShellSkeleton. |
| [src/app/manifest.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/manifest.ts) | Web manifest with name, standalone display, colors, start URL and icon metadata. |
| [src/app/not-found.tsx](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/not-found.tsx) | Client 404 page with persisted theme and workspace shortcut links. |
| [src/app/page.tsx](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/page.tsx) | Client entry point, sign-in and single-page workspace; contains task, expense, treasury, event-report and preview sections. |
| [src/app/skeleton.tsx](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/skeleton.tsx) | WorkspaceMainSkeleton and WorkspaceShellSkeleton loading placeholders. |

### HTTP adapters

| File | Purpose |
|---|---|
| [src/app/api/announcements/[id]/outbox/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/%5Bid%5D/outbox/route.ts) | GET `/api/announcements/{id}/outbox`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/announcements/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/%5Bid%5D/route.ts) | GET `/api/announcements/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/announcements/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/route.ts) | GET, POST `/api/announcements`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/auth/_shared.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/_shared.ts) | Maps Actor to SessionUser, exposes permissions and builds auth JSON/cookie responses. |
| [src/app/api/auth/login/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/login/route.ts) | POST `/api/auth/login`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/auth/logout/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/logout/route.ts) | POST `/api/auth/logout`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/auth/me/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/me/route.ts) | GET `/api/auth/me`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/auth/register/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/register/route.ts) | POST `/api/auth/register`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/dashboard/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/dashboard/route.ts) | GET `/api/dashboard`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/guest-tickets/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/guest-tickets/route.ts) | POST `/api/events/{id}/guest-tickets`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/holds/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/holds/route.ts) | GET `/api/events/{id}/holds`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/report/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/report/route.ts) | GET `/api/events/{id}/report`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/route.ts) | GET, PATCH `/api/events/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/scan/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/scan/route.ts) | POST `/api/events/{id}/scan`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/[id]/tickets/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/tickets/route.ts) | GET, POST `/api/events/{id}/tickets`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/events/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/route.ts) | GET, POST `/api/events`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/expenses/[id]/[action]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/expenses/%5Bid%5D/%5Baction%5D/route.ts) | POST `/api/expenses/{id}/{action}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/expenses/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/expenses/route.ts) | GET, POST `/api/expenses`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/health/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/health/route.ts) | GET `/api/health`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/ledger/entries/[id]/source/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/entries/%5Bid%5D/source/route.ts) | GET `/api/ledger/entries/{id}/source`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/ledger/entries/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/entries/route.ts) | GET `/api/ledger/entries`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/ledger/export.csv/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/export.csv/route.ts) | GET `/api/ledger/export.csv`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/ledger/export/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/export/route.ts) | GET `/api/ledger/export`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/ledger/summary/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/summary/route.ts) | GET `/api/ledger/summary`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/members/[id]/dues/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/dues/route.ts) | GET `/api/members/{id}/dues`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/members/[id]/password/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/password/route.ts) | POST `/api/members/{id}/password`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/members/[id]/role/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/role/route.ts) | PATCH `/api/members/{id}/role`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/members/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/route.ts) | GET, POST `/api/members`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/membership/dues/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/dues/route.ts) | POST `/api/membership/dues`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/membership/expiring/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/expiring/route.ts) | GET `/api/membership/expiring`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/membership/reminders/run/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/reminders/run/route.ts) | POST `/api/membership/reminders/run`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/notifications/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/notifications/route.ts) | GET `/api/notifications`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/orders/[id]/cancel/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/cancel/route.ts) | POST `/api/orders/{id}/cancel`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/orders/[id]/confirm/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/confirm/route.ts) | POST `/api/orders/{id}/confirm`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/orders/[id]/fulfil/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/fulfil/route.ts) | POST `/api/orders/{id}/fulfil`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/orders/mine/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/mine/route.ts) | GET `/api/orders/mine`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/orders/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/route.ts) | GET, POST `/api/orders`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/products/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/%5Bid%5D/route.ts) | GET, PATCH `/api/products/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/products/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/route.ts) | GET, POST `/api/products`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/products/variants/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/variants/%5Bid%5D/route.ts) | PATCH `/api/products/variants/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/receipts/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/receipts/%5Bid%5D/route.ts) | GET `/api/receipts/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/receipts/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/receipts/route.ts) | POST `/api/receipts`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tasks/[id]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/%5Bid%5D/route.ts) | GET, PATCH `/api/tasks/{id}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tasks/[id]/status/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/%5Bid%5D/status/route.ts) | POST `/api/tasks/{id}/status`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tasks/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/route.ts) | GET, POST `/api/tasks`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tickets/[id]/cancel/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/%5Bid%5D/cancel/route.ts) | POST `/api/tickets/{id}/cancel`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tickets/[id]/confirm/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/%5Bid%5D/confirm/route.ts) | POST `/api/tickets/{id}/confirm`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/api/tickets/mine/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/mine/route.ts) | GET `/api/tickets/mine`. Request/response and access rules: [HTTP reference](HTTP-API.md). |
| [src/app/t/[token]/route.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/t/%5Btoken%5D/route.ts) | GET `/t/{token}`. Request/response and access rules: [HTTP reference](HTTP-API.md). |

### Shared backend and utilities

| File | Purpose |
|---|---|
| [src/lib/api-url.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/api-url.ts) | Origin/path helpers reserved for a future Expo client; browser UI uses relative API paths. |
| [src/lib/auth/authorize.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/authorize.ts) | required/optional actor resolution, permission gate and authenticated-bearer exception to cookie origin checks. |
| [src/lib/auth/password.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/password.ts) | Salted scrypt hashes and password comparison using timingSafeEqual. |
| [src/lib/auth/permissions.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts) | Five roles, 19 permission names, role permission sets and hasPermission(). |
| [src/lib/auth/session.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts) | Token creation/hashing/selection, seven-day lifetime and HttpOnly cookie construction/clearing. |
| [src/lib/auth/tokens.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts) | Member/ticket QR token and short-code generation, normalization and bounded collision retries. |
| [src/lib/contracts.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/contracts.ts) | All shared public request/response types and the receipt byte limit. Full declarations are below. |
| [src/lib/cors.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/cors.ts) | Parse configured exact origins and decide whether a browser origin is allowed. |
| [src/lib/database.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/database.ts) | Store factory/singleton, connection lifecycle, migrations, shared context and module composition. |
| [src/lib/db/core.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts) | DbContext, nested synchronous transactions/savepoints, SQLite error constants, row conversion and club-date helpers. |
| [src/lib/db/migrations.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts) | Ordered schema migrations through v11 and synthetic seeds; preserve released versions. |
| [src/lib/errors.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts) | DomainError plus validation, unauthorized, forbidden, not-found, conflict and duplicate-member errors. |
| [src/lib/http.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/http.ts) | No-store JSON, JSON/Zod parsing, domain error mapping and promise-parameter route wrapper. |
| [src/lib/local-datetime.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/local-datetime.ts) | Convert an ISO instant to a browser-local datetime-local field without treating UTC as local time. |
| [src/lib/member-validation.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/member-validation.ts) | Strict trimmed name and normalized-email schema for member creation. |
| [src/lib/modules/announcements.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts) | Immediate idempotent publication, active-member recipient snapshot, archive and private simulated delivery inspection. |
| [src/lib/modules/dashboard.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dashboard.ts) | Club overview with permission-filtered members/finances and server-calculated counts. |
| [src/lib/modules/dues.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts) | Dues amount/recording, renewal expiry, payment history, expiring members, reminders, notifications and simulated outbox. |
| [src/lib/modules/events.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts) | Event validation/CRUD, atomic ticket reservation, hold expiry, guest/member booking, payment, cancellation, scan and reports. |
| [src/lib/modules/identity.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts) | Members, credentials, sessions, actor lookup, role/password changes, member passes, audit and internal club helpers. |
| [src/lib/modules/ledger.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts) | Exactly-once source-linked entries, internal ledger list/balance and bidirectional reconciliation. |
| [src/lib/modules/membership-state.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts) | Single membership eligibility rule and matching SQL predicates, inclusive of expiry day. |
| [src/lib/modules/merchandise.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts) | Product variants, available stock, atomic order holds, member pricing, confirmation, cancellation and handover. |
| [src/lib/modules/workspace.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts) | Task operations, receipt storage/access, expenses, approval/payment, actor-scoped ledger/source summaries and fundraiser reports. |
| [src/lib/mutation-guard.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/mutation-guard.ts) | Origin/Host and Sec-Fetch-Site checks for browser mutations, plus compatibility response helper. |
| [src/lib/validation.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/validation.ts) | Generic Zod parsing and conversion of validation issues into field/message domain errors. |
| [src/proxy.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/proxy.ts) | Development-only /api CORS preflight and actual response headers; not authentication. |

### Scripts and tests

| File | Purpose |
|---|---|
| [scripts/check-contract-docs.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/scripts/check-contract-docs.ts) | Checks 12 route-family strings and three delivery phrases in docs/API.md; does not validate every endpoint shape. |
| [scripts/check-foundation.mjs](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/scripts/check-foundation.mjs) | Build-dependent real HTTP acceptance script using temporary storage, random demo password and server restart. |
| [tests/announcements.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/announcements.test.ts) | Publication validation, authorization, recipient snapshots, rollback, durable retries and private outbox/inbox access. |
| [tests/auth-followups.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/auth-followups.test.ts) | Bearer precedence and logout/session/origin edge cases. |
| [tests/auth.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/auth.test.ts) | Registration/login/session/role contracts and protected member operations. |
| [tests/cors.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/cors.test.ts) | Development CORS allowlist, preflights, environment gating and independence from authentication/CSRF. |
| [tests/database.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/database.test.ts) | SQLite initialization, validation, seed preservation and durable member records. |
| [tests/delivery.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/delivery.test.ts) | Local deadline conversion, CORS proxy and future-client API URL helpers. |
| [tests/event-tickets.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/event-tickets.test.ts) | Event lifecycle, guest/member pricing, capacity, hold expiry, payment, scanning and reports. |
| [tests/fixtures/reservation-worker.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/fixtures/reservation-worker.ts) | Separate-process worker used to test reservation concurrency against shared storage. |
| [tests/helpers.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/helpers.ts) | Isolated DB/receipt fixtures, fixed clock, synthetic actors and request/cookie/route-context helpers. |
| [tests/ledger-reconciliation.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/ledger-reconciliation.test.ts) | Reconciliation across dues, ticket, order and expense source states. |
| [tests/ledger.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/ledger.regression-1.test.ts) | Missing/mismatched posted-source reconciliation regressions. |
| [tests/member-route.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/member-route.test.ts) | HTTP member creation and directory authorization/validation/error behavior. |
| [tests/membership-dues.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/membership-dues.test.ts) | Renewal arithmetic, club-date boundaries, duplicate payment references and reminders. |
| [tests/membership-state.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/membership-state.regression-1.test.ts) | Shared membership predicate and dashboard/privacy regressions. |
| [tests/merchandise.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/merchandise.test.ts) | Size stock, order reservations, pricing, pending limits, payment/cancel/fulfil and ledger integration. |
| [tests/p0-foundations.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/p0-foundations.test.ts) | Membership state, passes, source-linked ledger, transaction/rollback and database foundations. |
| [tests/receipt-ledger.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/receipt-ledger.test.ts) | Receipt upload/security/migration, expense transitions, payer/source links and numeric CSV/reconciliation. |
| [tests/reservations.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/reservations.regression-1.test.ts) | Reservation concurrency across processes. |
| [tests/workspace.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/workspace.test.ts) | Tasks, receipt-backed claims, approval/payment, role/scope enforcement and treasury/event summaries. |

## Backend function index

This navigation index lists named functions and exported declarations. Private helpers are included for code exploration; the module return object and types define which functions are callable by consumers. Each link opens the declaration in the pinned source.

### `src/lib/api-url.ts`

[ApiUrlConfigurationError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/api-url.ts#L1), [resolveExpoApiUrl](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/api-url.ts#L7), [apiUrl](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/api-url.ts#L26).

### `src/lib/auth/authorize.ts`

[AuthorizeOptions](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/authorize.ts#L8), [requireActor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/authorize.ts#L19), [optionalActor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/authorize.ts#L33).

### `src/lib/auth/password.ts`

[hashPassword](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/password.ts#L6), [verifyPassword](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/password.ts#L15).

### `src/lib/auth/permissions.ts`

[ROLES](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L1), [Role](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L2), [PERMISSIONS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L4), [Permission](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L25), [ROLE_PERMISSIONS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L30), [hasPermission](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/permissions.ts#L61).

### `src/lib/auth/session.ts`

[SESSION_COOKIE](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L3), [SESSION_TTL_MS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L4), [generateSessionToken](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L6), [hashSessionToken](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L11), [readSessionToken](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L15), [sessionCookie](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L34), [clearedSessionCookie](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/session.ts#L44).

### `src/lib/auth/tokens.ts`

[CROCKFORD](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L5), [SHORT_CODE_LENGTH](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L6), [TOKEN_COLLISION_MAX_ATTEMPTS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L7), [generateQrToken](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L10), [generateShortCode](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L15), [normalizeShortCode](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L23), [MemberTokens](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L27), [allocateUniqueTokens](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/auth/tokens.ts#L36).

### `src/lib/cors.ts`

[parseCorsOrigins](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/cors.ts#L2), [isAllowedCorsOrigin](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/cors.ts#L18).

### `src/lib/database.ts`

[openClubDatabase](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/database.ts#L19), [ClubDatabase](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/database.ts#L70), [applicationClock](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/database.ts#L73), [getDatabase](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/database.ts#L85).

### `src/lib/db/core.ts`

[Row](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L3), [DbContext](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L6), [transaction](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L17), [SQLITE_CONSTRAINT_CHECK](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L37), [SQLITE_CONSTRAINT_FOREIGNKEY](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L38), [SQLITE_CONSTRAINT_UNIQUE](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L39), [isConstraintError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L41), [text](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L48), [int](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L49), [nullableText](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L50), [CLUB_UTC_OFFSET_MINUTES](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L53), [clubDate](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L54), [addDays](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/core.ts#L57).

### `src/lib/db/migrations.ts`

[DEFAULT_CLUB_ID](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L6), [SCHEMA_VERSION](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L30), [addAnnouncementPublication](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L33), [addReceiptStorageNames](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L49), [migrate](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L57), [createStarterSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L78), [seedStarterDemo](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L127), [DEMO_OFFICERS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L162), [demoPassword](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L173), [addIdentityAndRoles](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L182), [DEMO_MEMBERS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L235), [addLedgerSourcesAndMemberPasses](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L240), [DEFAULT_ANNUAL_DUES_PAISE](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L282), [addMembershipDues](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L284), [addEventTickets](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L336), [addWorkspaceFlows](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L376), [addMerchandiseOrders](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/db/migrations.ts#L441).

### `src/lib/errors.ts`

[DomainError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L2), [ValidationError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L14), [UnauthorizedError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L20), [ForbiddenError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L26), [NotFoundError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L32), [ConflictError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L38), [DuplicateMemberError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/errors.ts#L45).

### `src/lib/http.ts`

[json](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/http.ts#L6), [readJson](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/http.ts#L10), [errorResponse](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/http.ts#L27), [route](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/http.ts#L42).

### `src/lib/local-datetime.ts`

[localDateTimeValue](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/local-datetime.ts#L2).

### `src/lib/member-validation.ts`

[createMemberSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/member-validation.ts#L3).

### `src/lib/modules/announcements.ts`

[publishAnnouncementSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L10), [mapAnnouncement](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L16), [createAnnouncementsModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L20), [requireRow](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L23), [listPublished](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L29), [getPublished](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L33), [publish](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L38), [inspectOutbox](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/announcements.ts#L72).

### `src/lib/modules/dashboard.ts`

[createDashboardModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dashboard.ts#L8), [getDashboard](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dashboard.ts#L15).

### `src/lib/modules/dues.ts`

[MEMBERSHIP_DAYS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L12), [REMINDER_WINDOW_DAYS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L13), [recordDuesSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L15), [expiringQuerySchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L16), [mapPayment](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L20), [createDuesModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L34), [duesAmount](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L37), [nextExpiry](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L44), [recordDues](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L49), [paymentsFor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L84), [expiringWithin](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L89), [sendRenewalReminders](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L113), [notificationsFor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L138), [simulatedOutbox](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L150), [DuesModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/dues.ts#L164).

### `src/lib/modules/events.ts`

[HOLD_MINUTES](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L14), [HOLD_MS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L15), [DOOR_MESSAGES](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L18), [createEventSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L37), [updateEventSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L41), [guestBookingSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L42), [confirmTicketSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L48), [scanSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L49), [mapEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L53), [maskEmail](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L71), [mapTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L79), [createEventsModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L111), [listEvents](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L119), [requireEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L126), [getEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L133), [createEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L139), [updateEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L153), [releaseExpiredHolds](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L177), [requireTicketRow](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L199), [issueTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L206), [bookTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L252), [bookGuestTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L267), [confirmTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L287), [cancelTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L318), [pendingHolds](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L338), [eventTickets](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L347), [myTickets](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L356), [publicTicket](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L364), [result](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L390), [attendeeFor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L394), [admit](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L401), [scan](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L429), [eventReport](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L453), [EventsModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/events.ts#L491).

### `src/lib/modules/identity.ts`

[Actor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L33), [IssuedSession](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L42), [passwordSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L48), [registerSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L53), [loginSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L54), [roleSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L57), [mapMember](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L59), [assertPermission](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L74), [createIdentityModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L78), [getMembers](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L81), [findMember](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L88), [requireMember](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L93), [insertMember](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L99), [getPass](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L142), [findMemberByPass](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L150), [createMember](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L159), [createMemberAs](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L164), [issueSession](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L173), [register](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L184), [login](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L192), [logout](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L202), [getActor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L211), [recordAudit](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L231), [setRole](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L254), [setPassword](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L267), [createClub](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L278), [createMemberWithCredentials](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L284), [listAudit](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L294), [IdentityModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/identity.ts#L331).

### `src/lib/modules/ledger.ts`

[LedgerEntryInput](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L7), [mapLedgerEntry](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L20), [postLedgerEntry](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L37), [listLedger](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L59), [ledgerBalance](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L63), [SourceResolver](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L71), [SOURCE_RESOLVERS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L73), [ReconciliationReport](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L79), [reconcileLedger](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/ledger.ts#L96).

### `src/lib/modules/membership-state.ts`

[MembershipState](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L3), [or](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L9), [membershipState](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L11), [membershipStateNow](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L16), [MEMBERSHIP_STATE_SQL](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L21), [MEMBERSHIP_ACTIVE_SQL](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/membership-state.ts#L24).

### `src/lib/modules/merchandise.ts`

[ORDER_HOLD_MINUTES](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L13), [ORDER_HOLD_MS](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L14), [MAX_PENDING_UNITS_PER_VARIANT](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L16), [createProductSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L19), [variantStockSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L28), [createOrderSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L29), [confirmOrderSchema](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L32), [mapOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L40), [createMerchandiseModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L66), [variantsFor](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L71), [mapProduct](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L79), [listProducts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L92), [requireProduct](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L99), [syncAggregateStock](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L106), [createProduct](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L110), [setVariantStock](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L129), [setProductActive](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L143), [releaseExpiredHolds](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L159), [requireOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L180), [createOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L190), [confirmOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L241), [cancelOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L270), [fulfilOrder](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L292), [myOrders](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L307), [listOrders](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L315), [MerchandiseModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/merchandise.ts#L343).

### `src/lib/modules/workspace.ts`

[mapTaskDetails](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L11), [mapExpense](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L29), [createWorkspaceModule](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L50), [requireEvent](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L52), [assignee](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L55), [getTaskById](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L60), [getTasks](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L65), [createTask](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L74), [patchTask](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L86), [updateTaskStatus](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L102), [getReceiptById](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L111), [saveReceipt](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L117), [getReceiptFile](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L148), [getExpenseById](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L157), [getExpenses](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L163), [submitExpense](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L168), [reviewExpense](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L184), [payExpense](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L196), [ledgerRows](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L211), [getLedgerEntries](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L232), [getLedgerSource](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L233), [getLedgerSummary](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L264), [getEventReport](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/modules/workspace.ts#L274).

### `src/lib/mutation-guard.ts`

[assertSameOrigin](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/mutation-guard.ts#L8), [rejectUnsafeMutation](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/mutation-guard.ts#L32).

### `src/lib/validation.ts`

[parseInput](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/validation.ts#L5), [toValidationError](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/lib/validation.ts#L11).

## Test inventory

These are declarations found in the test source, not results from a new full-suite run. Some tests contain multiple assertions/subcases or use a child process. Use `npm test` and the foundation command to establish current results.

### [tests/announcements.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/announcements.test.ts)

Publication validation, authorization, recipient snapshots, rollback, durable retries and private outbox/inbox access.

- publication validates input and enforces every role at the domain boundary
- publication freezes active recipients at IST midnight and retries do not add new members
- failure in either delivery table or audit rolls back publication and permits a clean retry
- public archive/detail hide recipients; HTTP routes enforce auth, validation, CSRF and notification isolation
- club boundaries isolate archive, dashboard, idempotency keys, outbox and recipients; empty publication succeeds
- v10 databases receive announcement migration and retain legacy archive/reminder rows

### [tests/auth-followups.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/auth-followups.test.ts)

Bearer precedence and logout/session/origin edge cases.

- production refuses the public default demo password
- unknown accounts still fail closed after the constant-cost check
- session cookie is Secure on HTTPS and behind a TLS-terminating proxy only
- admin gives an officer-created member a password, and only admins can

### [tests/auth.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/auth.test.ts)

Registration/login/session/role contracts and protected member operations.

- role matrix: only admin manages roles, only officers see members, finance is treasurer/admin
- register, login, session lookup and logout work through the HTTP routes
- sessions expire after their TTL and revoked sessions stop working
- role changes are admin-only, audited, scoped to the club and never self-applied
- role route and dashboard enforce 401/403 and hide personal and finance data
- unauthenticated and forbidden errors map to 401 and 403 consistently
- native login returns the same session as the cookie and bearer writes still enforce roles
- invalid Authorization never falls back to cookies on protected, public or logout routes
- expired and revoked bearer sessions cannot use a still-valid cookie

### [tests/cors.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/cors.test.ts)

Development CORS allowlist, preflights, environment gating and independence from authentication/CSRF.

- development allowlist supports PATCH and bearer headers without credentialed cookies
- CORS rejects unlisted origins, wildcard/null origins, unsupported methods and headers
- CORS is opt-in in development and disabled outside development even with an allowlist
- allowlisted CORS never grants authentication, cookie CSRF bypass or extra role permissions

### [tests/database.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/database.test.ts)

SQLite initialization, validation, seed preservation and durable member records.

- member creation normalizes input, starts unpaid and rejects case-insensitive duplicates
- invalid input is rejected without adding records
- member records persist after reopening and migration does not duplicate seeds
- dashboard subtracts expenses in integer paise and excludes expired memberships and past events

### [tests/delivery.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/delivery.test.ts)

Local deadline conversion, CORS proxy and future-client API URL helpers.

- editing a local deadline preserves its instant in non-UTC time zones
- CORS only accepts explicitly configured, valid origins
- API proxy handles allowed preflight and rejects unlisted browser origins
- Expo API URL resolution is absolute and does not accept paths or secrets

### [tests/event-tickets.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/event-tickets.test.ts)

Event lifecycle, guest/member pricing, capacity, hold expiry, payment, scanning and reports.

- booking fixes price from membership state, allows one live ticket per member or guest email, and guests get a /t link
- the last seat cannot be oversold across two connections and capacity cannot drop below held seats
- holds expire after 30 minutes and return the seat once; stale confirmation writes no income; duplicates are idempotent
- the door table: every scan outcome, repeat scans never admit twice, and the report counts attendance and revenue
- ticket routes: permissions, same-origin guest booking, 201/200 confirmation, scan, public ticket link

### [tests/ledger-reconciliation.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/ledger-reconciliation.test.ts)

Reconciliation across dues, ticket, order and expense source states.

- merchandise income stays in its club ledger with its payment reference
- reimbursements (#7): only payment changes balance, with one source and the paying officer
- starter transactions are honest opening balances and the ledger reconciles cleanly
- postLedgerEntry posts each source exactly once, inside a transaction, with positive integer paise
- tickets (#5): a confirmed ticket posts one `ticket` income row that reconciles; holds and cancellations post nothing
- merchandise (#6): a confirmed order posts one `merch_order` income row that reconciles; expired and cancelled holds post nothing

### [tests/ledger.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/ledger.regression-1.test.ts)

Missing/mismatched posted-source reconciliation regressions.

- reconciliation detects missing and mismatched entries for every money-moving source

### [tests/member-route.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/member-route.test.ts)

HTTP member creation and directory authorization/validation/error behavior.

- member API requires an officer session and returns actionable status codes
- mutation guard uses the direct Host when Next.js normalizes the request URL
- mutation guard rejects different origins and ignores forwarded authority headers
- mutation guard rejects malformed Host authorities

### [tests/membership-dues.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/membership-dues.test.ts)

Renewal arithmetic, club-date boundaries, duplicate payment references and reminders.

- first payment, early renewal and expired renewal follow the +365 rule and post one ledger row each
- membership is valid through the expiry day in club time and expired the next club day
- reminders: expiring list, one notification and one simulated outbox row per member per expiry, repeats skipped
- dues routes: permissions, 201 then 200 on replay, expiring and reminders

### [tests/membership-state.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/membership-state.regression-1.test.ts)

Shared membership predicate and dashboard/privacy regressions.

- membership SQL and JS agree for yesterday, today, tomorrow and null across IST midnight

### [tests/merchandise.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/merchandise.test.ts)

Size stock, order reservations, pricing, pending limits, payment/cancel/fulfil and ledger integration.

- products carry per-size stock; orders fix the member discount from membership state, reject zero stock and cap pending units at two
- the last unit cannot be oversold across two connections
- holds expire after 30 minutes and return stock once; stale and duplicate confirmations post nothing extra; fulfilment follows payment
- merchandise routes: permissions, 201/200 confirmation, cancel, fulfil, stock edits

### [tests/p0-foundations.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/p0-foundations.test.ts)

Membership state, passes, source-linked ledger, transaction/rollback and database foundations.

- membershipState: JS and SQL agree for today, yesterday and null, on the club calendar day
- seeded active and expired demo members can sign in and carry the right state and a pass
- member passes are unique, resolvable by token or typed code, and never leak the QR token in lists
- token allocation retries collisions at most five times and then fails loudly

### [tests/receipt-ledger.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/receipt-ledger.test.ts)

Receipt upload/security/migration, expense transitions, payer/source links and numeric CSV/reconciliation.

- simultaneous reimbursement confirmations on separate connections post once
- receipt boundaries: detected formats, exact 5 MB, missing receipt and private attachments
- v9 upgrade preserves extensionless receipts, IDs, ownership, claims and settled money
- receipt insert failure removes its new file and leaves no metadata
- canonical CSV and source links retain exact IDs, officer names, escaped cells and reconciled totals

### [tests/reservations.regression-1.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/reservations.regression-1.test.ts)

Reservation concurrency across processes.


### [tests/workspace.test.ts](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/tests/workspace.test.ts)

Tasks, receipt-backed claims, approval/payment, role/scope enforcement and treasury/event summaries.

- workspace routes require sessions and derive submitter/reviewer identity from them
- tasks enforce club boundaries, assignment permissions and normalized deadlines
- expense ownership, self review, payment retry and rollback keep one reconciled ledger
- receipt upload is owned by session and private across accounts
- schema v8 upgrades preserve members, passes, sessions, merchandise and opening balances
- task editing clears nullable fields and filters overdue work correctly
- expense rejection and CSV export preserve decisions and escape spreadsheet cells
- receipt validation rejects empty, oversized and disguised files
- dues, ticket income and expenses share scoped treasury and combined event reports

Inventory: 17 test-suite files; 74 directly named test declarations. The real-server foundation script is separate.

## Shared API types

The following declarations are copied verbatim from the pinned `src/lib/contracts.ts`. They describe transport shapes, not all runtime input validation. See [HTTP API](HTTP-API.md) for Zod constraints, role checks and response envelopes. `ExpenseLedgerEntry` is the enriched treasury view; `LedgerEntry` is the lower-level source-linked ledger shape.

```typescript
/** Public API shapes. Money is stored and returned as integer paise. */
export type Role = "member" | "volunteer" | "organizer" | "treasurer" | "admin";

export interface Member {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  expiresOn: string | null;
  duesStatus: "paid" | "unpaid";
  role: Role;
  membership: "active" | "expired" | "none";
  shortCode: string;
}

export interface Event {
  id: string;
  title: string;
  startsAt: string;
  venue: string;
  capacity: number;
  registered: number;
  memberPricePaise: number;
  guestPricePaise: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

/** Publishing is immediate; reuse this key and normalized content when retrying. */
export interface PublishAnnouncementInput {
  idempotencyKey: string;
  title: string;
  body: string;
}

export interface AnnouncementPublication {
  announcement: Announcement;
  created: boolean;
  recipientCount: number;
  delivery: "simulated";
}

/** Private delivery inspection, restricted to outbox:manage holders. */
export interface AnnouncementOutboxMessage {
  id: string;
  announcementId: string;
  memberId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "simulated";
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  pricePaise: number;
  stock: number;
}

/** Basic task shape used by the dashboard overview. */
export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: "todo" | "in_progress" | "done";
}

/** Detailed task shape used by the full task board (issue #13). */
export interface TaskDetails {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  assigneeId: string | null;
  status: "todo" | "in_progress" | "done";
  eventId: string | null;
  eventTitle: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId?: string;
  eventId?: string;
  dueAt?: string;
}

export interface PatchTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  eventId?: string | null;
  dueAt?: string | null;
}

export interface UpdateTaskStatusInput {
  status: "todo" | "in_progress" | "done";
}

export interface Transaction {
  id: string;
  description: string;
  kind: "income" | "expense";
  amountPaise: number;
  occurredAt: string;
}

// ── Receipt ──────────────────────────────────────────────────────────────────

/** Decimal MB; shared by web validation and the upload boundary. */
export const MAX_RECEIPT_SIZE_BYTES = 5_000_000;

export interface Receipt {
  id: string;
  uploaderId: string;
  uploaderName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// ── Expense ───────────────────────────────────────────────────────────────────

export type ExpenseStatus = "submitted" | "approved" | "rejected" | "paid";

export interface Expense {
  id: string;
  submitterId: string;
  submitterName: string;
  amountPaise: number;
  purpose: string;
  receiptId: string | null;
  receiptReference: string | null;
  eventId: string | null;
  eventTitle: string | null;
  status: ExpenseStatus;
  rejectionNote: string | null;
  paymentReference: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}

export interface SubmitExpenseInput {
  amountPaise: number;
  purpose: string;
  receiptId: string;
  receiptReference?: string;
  eventId?: string;
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export interface LedgerSummary {
  inflowPaise: number;
  outflowPaise: number;
  balancePaise: number;
  approvedUnpaidPaise: number;
  byCategory: { category: string; inflowPaise: number; outflowPaise: number }[];
  byEvent: { eventId: string; eventTitle: string; inflowPaise: number; outflowPaise: number }[];
}

export interface ExpenseLedgerEntry {
  id: string;
  type: "income" | "expense_paid";
  description: string;
  amountPaise: number;
  category: string | null;
  eventId: string | null;
  eventTitle: string | null;
  reference: string | null;
  occurredAt: string;
  kind: "income" | "expense";
  sourceType: string;
  sourceId: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
}

/** Permission-scoped details of the exact record behind a ledger row. */
export interface LedgerSource {
  type: string;
  id: string;
  title: string;
  details: Array<{ label: string; value: string }>;
  receiptId: string | null;
}

// ── Event report ──────────────────────────────────────────────────────────────

export interface WorkspaceEventReport {
  eventId: string;
  eventTitle: string;
  fundraiser: {
    goalPaise: number;
    raisedPaise: number;
    remainingPaise: number;
    percent: number;
    onTrack: boolean;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface Dashboard {
  club: { name: string; description: string };
  metrics: {
    members: number;
    activeMembers: number;
    upcomingEvents: number;
    balancePaise: number;
  };
  members: Member[];
  events: Event[];
  announcements: Announcement[];
  products: Product[];
  tasks: Task[];
  transactions: Transaction[];
  access: { members: boolean; finance: boolean };
}

export interface CreateMemberInput {
  name: string;
  email: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  clubId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
  expiresAt: string;
  token: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LedgerEntry extends Transaction {
  sourceType: string | null;
  sourceId: string | null;
  recordedBy: string | null;
}

/** Membership dues (P1, #4) */
export interface DuesPayment {
  id: string;
  memberId: string;
  reference: string;
  amountPaise: number;
  previousExpiresOn: string | null;
  newExpiresOn: string;
  recordedBy: string;
  recordedAt: string;
}

export interface ExpiringMember {
  id: string;
  name: string;
  email: string;
  expiresOn: string;
  daysLeft: number;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  announcementId: string | null;
}

/** Event tickets (P2, #5) */
export type EventStatus = "draft" | "published" | "cancelled";

export interface EventDetails extends Event {
  description: string;
  status: EventStatus;
  /** Seats not held or sold: capacity minus registered. */
  available: number;
}

export type TicketStatus = "pending_payment" | "paid" | "cancelled" | "expired";

export interface Ticket {
  id: string;
  eventId: string;
  memberId: string | null;
  guestName: string | null;
  /** Masked unless the viewer is an officer. */
  guestEmail: string | null;
  holderName: string;
  pricing: "member" | "guest";
  pricePaise: number;
  status: TicketStatus;
  holdExpiresAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  confirmedBy: string | null;
  /** 10-character Crockford code typed at the door. */
  shortCode: string;
  /** Only returned to the holder (member booking response, own list, /t/{token}). */
  qrToken?: string;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a guest sees at /t/{qr_token}. */
export interface PublicTicket {
  id: string;
  event: { id: string; title: string; startsAt: string; venue: string };
  holderName: string;
  status: TicketStatus;
  pricePaise: number;
  shortCode: string;
  holdExpiresAt: string | null;
  checkedInAt: string | null;
}

export type ScanOutcome = "admitted" | "already_checked_in" | "payment_pending" | "not_valid" | "member_no_ticket" | "no_ticket_membership_expired";

/** Fixed door contract (#5). `message` is what the volunteer reads out. */
export interface ScanResult {
  outcome: ScanOutcome;
  message: string;
  admitted: boolean;
  attendee?: { name: string; membership: "active" | "expired" | "none" | "guest" };
  ticketId?: string;
  checkedInAt?: string | null;
}

export interface EventReport {
  event: EventDetails;
  tickets: { pendingPayment: number; paid: number; cancelled: number; expired: number };
  ticketsSold: number;
  attendance: number;
  /** Sum of `ticket` income rows in the ledger for this event. */
  realizedRevenuePaise: number;
}

/** Merchandise (P3, #6) */
export interface ProductVariant {
  id: string;
  size: string;
  /** Units available to order right now (holds already subtracted). */
  stock: number;
}

export interface ProductDetails extends Product {
  description: string;
  /** Price for active members; null means no member discount. */
  memberPricePaise: number | null;
  active: boolean;
  variants: ProductVariant[];
}

export type MerchOrderStatus = "pending_payment" | "paid" | "fulfilled" | "cancelled" | "expired";

export interface MerchOrder {
  id: string;
  memberId: string;
  memberName: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  pricing: "member" | "standard";
  status: MerchOrderStatus;
  holdExpiresAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  confirmedBy: string | null;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a member shows at the door: QR payload and typed fallback. */
export interface MemberPass {
  qrToken: string;
  shortCode: string;
  membership: "active" | "expired" | "none";
  expiresOn: string | null;
}
```
