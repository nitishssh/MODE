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

Permissions for tickets #4–#9 are reserved here so the UI can be built against the final matrix; the routes behind them land with their tickets.

### Demo accounts

Schema v2 seeds four synthetic officer accounts in the sample club: `lead@example.com` (admin), `organizer@example.com`, `treasurer@example.com`, `volunteer@example.com`. Their shared password is `MODE_DEMO_PASSWORD` (default `mode-demo-2026`). The three starter members have no password until an admin sets one. No record contains real student information.

## Membership dues, benefits and renewals (#4)

Membership is a dated period on a plan, not a flag. The shared rule used by tickets (#5) and merchandise (#6) is `membership.statusFor(clubId, memberId)`: a member is **active** when the club calendar day (Asia/Kolkata) lies inside a membership period, and gets **member pricing** only when that plan grants it. Expired members fall back to guest pricing automatically.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/membership/plans` | public | 200 `{plans:MembershipPlan[]}` | 500 |
| GET | `/api/membership/me` | signed in | 200 `{membership:MembershipStatus}` | 401 |
| GET | `/api/members/{id}/membership` | `members:read` | 200 `{membership:MembershipStatus}` | 401; 403; 404 |
| POST | `/api/membership/payments` | `membership:record_payment` | 201 created · 200 replayed `{membership,payment,created,status}` | 400 missing reference / wrong amount; 401; 403; 404 member or plan; 409 reference reused or duplicate free enrolment |
| POST | `/api/membership/reminders/run` | `membership:reminders` | 200 `{asOf,horizon,candidates,created,skipped}` | 401; 403 |

Record-dues request:

```json
{"memberId":"…","planId":"plan-annual","paymentReference":"UPI-2026-0001","amountPaise":50000}
```

- Seeded plans: `plan-associate` (free, 365 days, no member pricing) and `plan-annual` (50000 paise, 365 days, member pricing).
- `paymentReference` is unique per club. Replaying the same reference for the same member, purpose and amount returns the original membership with `created:false` and credits nothing. Reusing it for anyone else is `409 payment_reference_reused`.
- `amountPaise` must equal the plan price; the server never trusts a client amount.
- Renewal is deterministic: when the latest period still runs, the new period starts the day after it ends; otherwise it starts today. `expiresOn = startsOn + durationDays`, valid through that day.
- Free plans need no payment; enrolling again while that free period is active is `409 duplicate_membership`.
- Every paid dues record posts exactly one ledger income row referencing the payment. `Member.duesStatus`/`expiresOn` mirror the latest period for the dashboard; `MembershipStatus` is authoritative.

### Renewal reminders and the outbox

`POST /api/membership/reminders/run` with optional `{"daysAhead":14}` queues one `membership_renewal` message per membership ending within the window that has not been renewed. The dedupe key `renewal:<membershipId>` makes repeated runs idempotent. Use `MODE_DEMO_NOW` to move the clock during a demo.

| Method | Path | Permission | Success |
|---|---|---|---|
| GET | `/api/outbox?kind=&status=` | `outbox:manage` | 200 `{transport,pending,messages:OutboxMessage[]}` |
| GET | `/api/outbox/{id}` | `outbox:manage` | 200 `{message}` incl. `body` and `transport` |
| POST | `/api/outbox/dispatch` | `outbox:manage` | 200 `{transport,previewed,remaining}` |

Outbox statuses are `pending`, `previewed`, `sent`, `failed`. The local transport is `preview` (`MODE_MAIL_TRANSPORT` unset): dispatch marks messages `previewed`, never `sent`. A real transport must be configured before anything is reported as sent; until then dispatch with `MODE_MAIL_TRANSPORT=smtp` answers `501 mail_transport_unavailable`. Recipient addresses are masked in listings and retries can never duplicate a message because each logical send has one row.

## Starter routes

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/health` | public | 200 `{status:"ok",database:"sqlite",schemaVersion:number}` | 503 `{status:"error",error}` |
| GET | `/api/dashboard` | public, richer when signed in | 200 `Dashboard` | 500 |
| GET | `/api/members` | `members:read` | 200 `{members:Member[]}` | 401; 403; 500 |
| POST | `/api/members` | `members:create` | 201 `{member:Member}` | 400 invalid/malformed; 401; 403; 409 duplicate email; 500 |

Create-member request stays `{"name","email"}`. Name is trimmed, 2–120 characters. Email is trimmed, validated, lowercased, at most 254 characters, and unique case-insensitively. A new member has `duesStatus:"unpaid"`, `expiresOn:null` and `role:"member"`; the officer who created it is recorded in the audit trail. Creating a member does not record a payment, activate benefits or grant a login.

`Dashboard` contains `club`, `metrics`, `members`, `events`, `announcements`, `products`, `tasks`, `transactions` and `access:{members:boolean,finance:boolean}`. Anonymous callers and plain members receive `members:[]`, `transactions:[]` and `balancePaise:0`; the `access` flags tell the UI which sections were withheld rather than empty. The starter active-member metric treats a paid membership as valid through its expiry date; the membership ticket (#4) finalizes the club-timezone rule.

## Data and invariants

- Schema changes are versioned migrations in `src/lib/db/migrations.ts`, applied in one write transaction and recorded in `PRAGMA user_version`. `GET /api/health` reports the current version.
- Member email has a case-insensitive UNIQUE constraint. API validation is also enforced at the store boundary.
- Sessions store only a SHA-256 hash of the cookie token with `expires_at`/`revoked_at`.
- `audit_events` records who changed what (`member.created`, `member.role_changed`, `member.password_set`, `membership.recorded`, and future finance decisions).
- `payments(club_id, reference)` is UNIQUE; `transactions(source_type, source_id)` is UNIQUE so each originating payment can post to the ledger only once.
- A sample event's `registered` count cannot exceed capacity. The starter has no booking operation yet.
- Ledger amounts are positive integer paise; `kind` determines income versus expense. Balance is calculated on the server.
- Products are aggregate read-only examples until the merchandise ticket introduces size variants.

## Planned conventions

These are design constraints for future tickets, not implemented endpoints:

- Ticketing: reserve capacity atomically; issue tickets against confirmed states; reject duplicate check-in in #5.
- Merchandise: use per-size stock and idempotent order/payment confirmation in #6.
- Treasury: distinguish requested, approved and paid reimbursements; trace each source transaction once in #7.
- Announcements: distinguish draft, publication and notification delivery; local outbox is not actual delivery in #8.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Secrets and demo credentials live in environment configuration, never in code.

## Local demo clock

`MODE_DEMO_NOW=<ISO timestamp>` freezes the server clock so expiry, reminders and deadlines can be demonstrated deterministically. Tests use an injected clock instead of this variable.
