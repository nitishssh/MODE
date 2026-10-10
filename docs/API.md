# MODE API contracts

The implemented types are authoritative in `src/lib/contracts.ts`. The backend owner is Divyank; contract/integration owner is Nitish; Azman consumes these shapes. Changes must update types, this document and related ticket acceptance tests together.

## Conventions

- All routes run on Node.js and read/write SQLite through `src/lib/database.ts`. Responses carry `Cache-Control: no-store`.
- Money fields ending in `Paise` are integer paise. ISO timestamps are UTC; date-only fields (`expiresOn`) are club calendar days in Asia/Kolkata.
- Errors are `{error:string, code?:string, details?:[{field,message}]}`. No database paths or stack traces reach the client.
- `401 unauthenticated` means no valid session cookie. `403 forbidden` means the session exists but the role lacks the permission, or a state-changing request arrived cross-origin.
- Every state-changing request (POST/PATCH/DELETE) must be same-origin: the `Origin` header has to match the request host and `Sec-Fetch-Site` must not be `cross-site`. Browsers send these automatically for `fetch` calls from the app.

## Identity and roles (#3)

Authentication is a server-side session referenced by the `mode_session` cookie (`HttpOnly; SameSite=Lax; Path=/`, `Secure` on HTTPS). Sessions last 7 days, are stored hashed, and can be revoked by logout. Passwords are stored as salted scrypt hashes. Every member belongs to exactly one club; all reads and writes are scoped to the caller's club.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | 201 `AuthResponse` + cookie | 400 invalid; 403 cross-origin; 409 duplicate email |
| POST | `/api/auth/login` | public | 200 `AuthResponse` + cookie | 400 invalid; 401 wrong email/password (same message for both); 403 cross-origin |
| POST | `/api/auth/logout` | public | 200 `{ok:true}` + cleared cookie | 403 cross-origin |
| GET | `/api/auth/me` | signed in | 200 `{user:SessionUser}` | 401 |
| PATCH | `/api/members/{id}/role` | `roles:manage` | 200 `{member:Member}` | 400 unknown role; 401; 403; 404 not in this club; 409 changing own role |
| POST | `/api/members/{id}/password` | `roles:manage` | 200 `{ok:true}` | 400 password under 8 or over 200 characters; 401; 403 (also cross-origin); 404 not in this club |

Request bodies:

```json
{"name":"Demo Student","email":"student@example.com","password":"at least 8 characters"}
{"email":"student@example.com","password":"..."}
{"role":"treasurer"}
```

`SessionUser` is `{id,name,email,role,clubId,permissions:string[]}`. The UI should drive navigation from `permissions`, not from role names, so the matrix can evolve without screen changes. `AuthResponse` is `{user:SessionUser, expiresAt}`.

### Role matrix

Roles: `member`, `volunteer`, `organizer`, `treasurer`, `admin` (club lead). Self-registration always creates a `member`; admins assign other roles. Role changes are written to the audit trail.

| Permission | member | volunteer | organizer | treasurer | admin |
|---|:-:|:-:|:-:|:-:|:-:|
| `roles:manage` | | | | | ✓ |
| `members:create` | | | ✓ | | ✓ |
| `members:read` (directory with emails) | | | ✓ | ✓ | ✓ |
| `membership:record_payment` | | | ✓ | ✓ | ✓ |
| `membership:reminders` | | | ✓ | | ✓ |
| `events:write` | | | ✓ | | ✓ |
| `events:report` | | | ✓ | ✓ | ✓ |
| `tickets:check_in` | | ✓ | ✓ | | ✓ |
| `bookings:create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payments:confirm` | | | ✓ | ✓ | ✓ |
| `products:write` | | | ✓ | | ✓ |
| `orders:create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `orders:fulfil` | | | ✓ | | ✓ |
| `ledger:read` | | | | ✓ | ✓ |
| `expenses:submit` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `expenses:review` | | | | ✓ | ✓ |
| `announcements:write` | | | ✓ | | ✓ |
| `outbox:manage` | | | ✓ | | ✓ |
| `tasks:write` | | | ✓ | | ✓ |

Permissions for unfinished tickets #4–#6 and #8 are reserved here so the UI can be built against the final matrix. Task, expense, receipt, ledger and event-report routes are documented below.

### Demo accounts

Schema v2 seeds four synthetic officer accounts in the sample club: `lead@example.com` (admin), `organizer@example.com`, `treasurer@example.com`, `volunteer@example.com`. Their shared password is `MODE_DEMO_PASSWORD` (default `mode-demo-2026` in development only; production refuses to start a new database without it). The three starter members have no password until an admin sets one with `POST /api/members/{id}/password` (audited as `member.password_set`). No record contains real student information.

## P0 foundations (#2)

- **Membership state** is one function, `membershipState(member, clubDate(now))` in `src/lib/modules/membership-state.ts`: `active` when `expiresOn >= ` the Asia/Kolkata date, `expired` when it has passed, `none` when null. Its SQL twin `MEMBERSHIP_ACTIVE_SQL` / `MEMBERSHIP_STATE_SQL` is used for counts and filters; tests prove JS and SQL agree on today, yesterday and null. `Member.membership` carries the derived value; `duesStatus` is a historical flag, not an eligibility rule.
- **Member pass**: every member has a unique 128-bit base64url `qrToken` and a unique 10-character Crockford base32 `shortCode` (bounded collision retry, max 5). `GET /api/auth/me` returns `pass:{qrToken,shortCode,membership,expiresOn}` to the member themselves; `Member` exposes `shortCode` only. Door scanning resolves a pass by token or code, never by sequential id (`findMemberByPass`).
- **Ledger**: `transactions` gains `sourceType`, `sourceId`, `recordedBy` with a UNIQUE index on the source pair. The three starter rows are backfilled as `opening_balance` entries with "Opening balance (pre-system): …" descriptions. Financial modules call `postLedgerEntry()` inside the same transaction as the source transition; it rejects non-positive or non-integer paise and a second post for the same source.
- **Reconciliation**: `reconcileLedger(db)` reports balance, opening balances, duplicates, unsourced rows and orphans (rows whose source no longer resolves). Modules register a resolver per `sourceType` in `SOURCE_RESOLVERS` and extend `tests/ledger-reconciliation.test.ts`.
- **Demo accounts**: `active@example.com` (membership active, expires in 300 days) and `expired@example.com` (expired 10 days ago), password `MODE_DEMO_PASSWORD`, join the four officer accounts. Schema version is 4.

## Starter routes

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/health` | public | 200 `{status:"ok",database:"sqlite",schemaVersion:number}` | 503 `{status:"error",error}` |
| GET | `/api/dashboard` | public, richer when signed in | 200 `Dashboard` | 500 |
| GET | `/api/members` | `members:read` | 200 `{members:Member[]}` | 401; 403; 500 |
| POST | `/api/members` | `members:create` | 201 `{member:Member}` | 400 invalid/malformed; 401; 403; 409 duplicate email; 500 |

Create-member request stays `{"name","email"}`. Name is trimmed, 2–120 characters. Email is trimmed, validated, lowercased, at most 254 characters, and unique case-insensitively. A new member has `duesStatus:"unpaid"`, `expiresOn:null` and `role:"member"`; the officer who created it is recorded in the audit trail. Creating a member does not record a payment, activate benefits or grant a login.

`Dashboard` contains `club`, `metrics`, `members`, `events`, `announcements`, `products`, `tasks`, `transactions` and `access:{members:boolean,finance:boolean}`. Anonymous callers and plain members receive `members:[]`, `transactions:[]` and `balancePaise:0`; the `access` flags tell the UI which sections were withheld rather than empty. The active-member metric uses expiry against the current Asia/Kolkata date, as described in P0 foundations above.

## Data and invariants

- Schema changes are versioned migrations in `src/lib/db/migrations.ts`, applied in one write transaction and recorded in `PRAGMA user_version`. `GET /api/health` reports the current version.
- Member email has a case-insensitive UNIQUE constraint. API validation is also enforced at the store boundary.
- Sessions store only a SHA-256 hash of the cookie token with `expires_at`/`revoked_at`.
- `audit_events` records who changed what (`member.created`, `member.role_changed`, `member.password_set`, task changes and expense decisions).
- A sample event's `registered` count cannot exceed capacity. The starter has no booking operation yet.
- Ledger amounts are positive integer paise; `kind` determines income versus expense. Balance is calculated on the server.
- Products are aggregate read-only examples until the merchandise ticket introduces size variants.

## Planned conventions

These are the ticket design constraints. Task and reimbursement endpoints described below implement the corresponding parts; the remaining workflows still require their tickets:

- Membership: define plans, free/paid status, benefit eligibility, renewal and idempotent dues recording in #4.
- Ticketing: reserve capacity atomically; issue tickets against confirmed states; reject duplicate check-in in #5.
- Merchandise: use per-size stock and idempotent order/payment confirmation in #6.
- Treasury: distinguish requested, approved and paid reimbursements; trace each source transaction once in #7.
- Announcements: distinguish draft, publication and notification delivery; local outbox is not actual delivery in #8.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Secrets and demo credentials live in environment configuration, never in code.

## Platform delivery and LAN access

MODE's web UI and API are served by the same Next.js origin. The root path already serves the web application, and `/api/*` remains handled by the Node.js route handlers. This is the supported browser deployment model; there is no separate Expo web export in this repository.

`GET /api/health` is the LAN-safe liveness check. Its successful response is `{status:"ok",database:"sqlite",schemaVersion:number}`. It does not authenticate a user and must not be treated as proof of identity or authorization.

### Authentication status

Browser authentication uses same-origin `HttpOnly`, `SameSite=Lax` session cookies (`Secure` on HTTPS). State-changing requests must be same-origin and are CSRF-protected by origin and fetch-site validation. Native clients must use an explicit credential flow rather than ambient browser cookies. Ticket check-in and a native Expo client are not implemented yet.

### CORS policy

Same-origin requests require no CORS configuration. Development cross-origin browser clients are denied unless their exact origin is listed in `MODE_CORS_ORIGINS`, a comma-separated list such as `http://192.168.1.50:8081,http://localhost:8081`. Wildcards, paths, queries, and malformed origins are ignored. Allowed origins receive explicit `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, `Content-Type`, `Authorization`, `X-Requested-With`, and methods including `PATCH`. `OPTIONS` preflights receive `204`; an unlisted Origin receives `403`. An absent Origin is not a CORS grant and follows the normal same-origin/native request path.

### Future Expo configuration

There is no Expo client in this repository today. A future Expo client must set `EXPO_PUBLIC_API_URL` to an absolute API origin reachable from the device, for example `http://192.168.1.50:3000` as a placeholder only. It must never contain secrets, paths, query strings, or hashes. The shared resolver in `src/lib/api-url.ts` rejects malformed values and defaults only to `http://127.0.0.1:3000` for simulator/local use; that loopback address does not reach a physical phone.
## Local demo clock

`MODE_DEMO_NOW=<ISO timestamp>` freezes the server clock so expiry, reminders and deadlines can be demonstrated deterministically. Tests use an injected clock instead of this variable.

## Tasks, expenses and receipts (schema v4)

All endpoints below require a session. Mutations also enforce same-origin requests.
Identity and club scope come from the session, never from request-body member IDs.

| Method | Path | Access | Response |
|---|---|---|---|
| GET | `/api/tasks` | signed in, own club | `TaskDetails[]`; filters: status, assigneeId, eventId, overdue=true, mine=true |
| POST | `/api/tasks` | tasks:write | 201 TaskDetails |
| GET / PATCH | `/api/tasks/{id}` | signed in / tasks:write | TaskDetails |
| POST | `/api/tasks/{id}/status` | assigned member or tasks:write | TaskDetails |
| GET | `/api/expenses` | own expenses; expenses:review sees club expenses | Expense[]; optional submitterId filter for reviewers |
| POST | `/api/expenses` | expenses:submit | 201 Expense |
| POST | `/api/expenses/{id}/{action}` | expenses:review | Expense; action is approve, reject or pay |
| POST | `/api/receipts` | expenses:submit | multipart file; 201 Receipt |
| GET | `/api/receipts/{id}` | uploader or expenses:review, same club | original file, private/no-store |
| GET | `/api/ledger/summary` | ledger:read | LedgerSummary |
| GET | `/api/ledger/entries` | ledger:read | ExpenseLedgerEntry[] |
| GET | `/api/ledger/export` | ledger:read | CSV with formula cells escaped |
| GET | `/api/events/{id}/report` | events:report | EventReport |

Task creation takes `{title,description?,assigneeId?,eventId?,dueAt?}`. PATCH permits the same optional fields, with null to clear description, assignee, event or deadline. Status takes `{status:"todo"|"in_progress"|"done"}`. Deadlines normalize to UTC. Assignment and event references must belong to the caller's club; mine uses the actual session member.

Expense submission takes `{amountPaise,purpose,receiptId?,receiptReference?,eventId?}`. Amounts must be positive safe integer paise. Receipt ownership is checked; one member cannot submit another member's receipt. Approve takes `{}`, reject takes `{note?}`, and pay takes `{paymentReference}`. No uploader, submitter or reviewer identity fields are accepted in JSON; multipart uploader fields are ignored.

An expense moves submitted → approved/rejected, then approved → paid. Officers cannot review or pay their own expenses. Payment takes a database write lock before reading state, updates the expense and posts one source-linked transaction atomically. Repeating the same payment reference returns the paid expense without another outflow; a different reference conflicts. Payment records a reimbursement already made externally; it does not transfer money.

The existing `transactions` ledger remains the single source of balances, including pre-system opening balances. There is no second expense ledger. Expense sources participate in reconciliation. Task changes and expense decisions are audited.

Receipts accept JPEG, PNG, WebP or PDF with checked signatures, at most 2 MiB. Uploads use a multipart field named `file`; oversized files return 413 and unsupported signatures return 415. Files live in the receipts directory beside SQLITE_PATH; failed database inserts remove their new file. Missing files return 404. Back up SQLite and this directory together.

Errors use 400 for invalid bodies, 401 for absent/expired sessions, 403 for role/ownership/origin failures, 404 for missing or foreign-club records, and 409 for invalid transitions. Schema v4 upgrades the released v1–v3 history without replacing existing members, sessions, passes or opening balances. Databases made by the earlier unmerged PR's conflicting schema are not a supported migration source.
