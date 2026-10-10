# MODE API contracts

The implemented types are authoritative in `src/lib/contracts.ts`. The backend owner is Divyank; contract/integration owner is Nitish; Azman consumes these shapes. Changes must update types, this document and related ticket acceptance tests together.

## Conventions

- All routes run on Node.js and read/write SQLite through `src/lib/database.ts`. Responses carry `Cache-Control: no-store`.
- Money fields ending in `Paise` are integer paise. ISO timestamps are UTC; date-only fields (`expiresOn`) are club calendar days in Asia/Kolkata.
- Errors are `{error:string, code?:string, details?:[{field,message}]}`. No database paths or stack traces reach the client.
- `401 unauthenticated` means no valid selected session. `403 forbidden` means the session exists but the role lacks the permission, or a cookie-authenticated write arrived cross-origin.
- Cookie-authenticated writes (POST/PATCH/DELETE) enforce same-origin: an `Origin` header, when present, must match the request host and `Sec-Fetch-Site` must not be `cross-site`. Only an authenticated bearer request bypasses this check. Login and registration always enforce the same-origin check; native clients omit browser origin headers.

## Identity and roles (#3)

Authentication is a server-side session referenced by the `mode_session` cookie (`HttpOnly; SameSite=Lax; Path=/`, `Secure` on HTTPS). Sessions last 7 days, are stored hashed, and can be revoked by logout. Passwords are stored as salted scrypt hashes. Every member belongs to exactly one club; all reads and writes are scoped to the caller's club.

Native clients may instead send `Authorization: Bearer <token>` using the token returned by login or registration. This references the same session row as the cookie. Whenever `Authorization` is present, the cookie is ignored: malformed, unknown, expired and revoked bearer tokens return 401, including on the optional-auth dashboard and logout. Valid bearer requests still enforce role permissions. Logout revokes only the selected session; the token and cookie for that session both stop working. Bearer logout sends no `Set-Cookie`, preserving unrelated browser cookies; cookie logout clears the browser session cookie.

Web clients use the HttpOnly cookie and do not persist the response token in browser storage. The planned native client will use `expo-secure-store`. Expo web hosting remains part of #10/#14.

### Development CORS

`src/proxy.ts` applies to `/api/:path*`. Only `NODE_ENV=development` enables the optional `MODE_CORS_ORIGINS` comma-separated allowlist of HTTP(S) origins, for example `http://localhost:8081,http://127.0.0.1:8081`. Configured trailing slashes normalize to the origin; non-root paths, credentials, queries, hashes, wildcards and `null` origins are ignored. Request origins must match a normalized allowlist entry exactly. Production ignores this configuration.

An allowed preflight returns 204 and advertises GET, HEAD, POST, PATCH, DELETE and OPTIONS with Content-Type/Authorization headers. Denied origins, methods or headers get 403 without ACAO. Actual responses grant ACAO only to allowed origins and vary by Origin; credentialed cross-origin cookies are not enabled. Native requests without Origin continue normally.

CORS does not authorize a request or relax cookie CSRF protection. Even an allowlisted browser origin cannot log in or perform cookie-authenticated mutations cross-origin. Native clients obtain a token through login without browser origin headers; cross-origin bearer API calls still require that valid token and the route's permission. The Expo web app uses same-origin login/cookies when served by the Next host.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | 201 `AuthResponse` + cookie | 400 invalid; 403 cross-origin; 409 duplicate email |
| POST | `/api/auth/login` | public | 200 `AuthResponse` + cookie | 400 invalid; 401 wrong email/password (same message for both); 403 cross-origin |
| POST | `/api/auth/logout` | cookie logout is idempotent; bearer must be valid | 200 `{ok:true}`; cookie auth also clears cookie | 401 invalid bearer; 403 cross-origin cookie request |
| GET | `/api/auth/me` | signed in | 200 `{user:SessionUser,pass:{qrToken,shortCode,membership,expiresOn}}` | 401 |
| PATCH | `/api/members/{id}/role` | `roles:manage` | 200 `{member:Member}` | 400 unknown role; 401; 403; 404 not in this club; 409 changing own role |
| POST | `/api/members/{id}/password` | `roles:manage` | 200 `{ok:true}` | 400 password under 8 or over 200 characters; 401; 403 (also cross-origin); 404 not in this club |

Request bodies:

```json
{"name":"Demo Student","email":"student@example.com","password":"at least 8 characters"}
{"email":"student@example.com","password":"..."}
{"role":"treasurer"}
```

`SessionUser` is `{id,name,email,role,clubId,permissions:string[]}`. The UI should drive navigation from `permissions`, not from role names, so the matrix can evolve without screen changes. `AuthResponse` is `{user:SessionUser, expiresAt, token}`. Auth responses use `Cache-Control: no-store`.

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

Permissions for unfinished merchandise and announcement workflows remain reserved. Implemented membership, ticket, task and reimbursement routes are documented below.

### Demo accounts

Schema v2 seeds four synthetic officer accounts in the sample club: `lead@example.com` (admin), `organizer@example.com`, `treasurer@example.com`, `volunteer@example.com`. Their shared password is `MODE_DEMO_PASSWORD` (default `mode-demo-2026` in development only; production refuses to start a new database without it). The three starter members have no password until an admin sets one with `POST /api/members/{id}/password` (audited as `member.password_set`). No record contains real student information.

## P0 foundations (#2)

- **Membership state** is one function, `membershipState(member, clubDate(now))` in `src/lib/modules/membership-state.ts`: `active` when `expiresOn >= ` the Asia/Kolkata date, `expired` when it has passed, `none` when null. Its SQL twin `MEMBERSHIP_ACTIVE_SQL` / `MEMBERSHIP_STATE_SQL` is used for counts and filters; tests prove JS and SQL agree on today, yesterday and null. `Member.membership` carries the derived value; `duesStatus` is a historical flag, not an eligibility rule.
- **Member pass**: every member has a unique 128-bit base64url `qrToken` and a unique 10-character Crockford base32 `shortCode` (bounded collision retry, max 5). `GET /api/auth/me` returns `pass:{qrToken,shortCode,membership,expiresOn}` to the member themselves; `Member` exposes `shortCode` only. Door scanning resolves a pass by token or code, never by sequential id (`findMemberByPass`).
- **Ledger**: `transactions` gains `sourceType`, `sourceId`, `recordedBy` with a UNIQUE index on the source pair. The three starter rows are backfilled as `opening_balance` entries with "Opening balance (pre-system): …" descriptions. Financial modules call `postLedgerEntry()` inside the same transaction as the source transition; it rejects non-positive or non-integer paise and a second post for the same source.
- **Reconciliation**: `reconcileLedger(db)` reports balance, opening balances, duplicates, unsourced rows and orphans (rows whose source no longer resolves). Modules register a resolver per `sourceType` in `SOURCE_RESOLVERS` and extend `tests/ledger-reconciliation.test.ts`.
- **Demo accounts**: `active@example.com` (membership active, expires in 300 days) and `expired@example.com` (expired 10 days ago), password `MODE_DEMO_PASSWORD`, join the four officer accounts. The current schema version is 9.

## Membership dues, renewals and reminders (#4, P1)

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| POST | `/api/membership/dues` `{memberId, reference}` | `membership:record_payment` | 201 recorded · 200 same reference replayed `{payment,created,membership,expiresOn}` | 400; 401; 403; 404 member; 409 reference used by another member |
| GET | `/api/membership/expiring?days=30` | `members:read` | 200 `{asOf, windowDays, members:ExpiringMember[]}` | 400; 401; 403 |
| POST | `/api/membership/reminders/run` `{days?}` | `membership:reminders` | 200 `{asOf,windowDays,candidates,sent,skipped}` | 401; 403 |
| GET | `/api/notifications` | signed in | 200 `{notifications:Notification[]}` | 401 |
| GET | `/api/members/{id}/dues` | `members:read` | 200 `{payments:DuesPayment[]}` | 401; 403; 404 |

- Officers record dues received; there is no member-side payment request and no gateway. The amount is the club's `annual_dues_paise` (default 50000), never a client value.
- First payment sets `expiresOn = clubToday + 365`; renewal sets `max(clubToday, currentExpiry) + 365`, so paying early never loses days. Eligibility everywhere is `membershipState`.
- The dues row, the member's new expiry and one `dues_payment` income ledger row (with `recordedBy`) commit in one transaction. Replaying a reference returns the same payment with `created:false` and credits nothing; another member's reference is `409`.
- Reminders: one in-app notification and one `simulated` outbox row per member per expiry date, enforced by `UNIQUE(member_id, expires_on)`; repeat runs report `skipped`. The outbox is explicitly simulated; no email is sent.

## Event tickets, holds and the door (#5, P2)

Ticketing was introduced in schema v6; reserved v5 remains skipped and workspace schema v9 follows merchandise v8. `events` gains `clubId`, `status` (`draft|published|cancelled`) and `description`; `tickets` holds member and guest bookings with a 30-minute hold, unique QR token and 10-character Crockford short code (same bounded collision retry as member passes, checked against both tables).

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/events` | public (organizers also see drafts) | 200 `{events:EventDetails[]}` | |
| POST | `/api/events` | `events:write` | 201 `{event}` | 400; 401; 403 |
| GET | `/api/events/{id}` | public (drafts 404 unless `events:write`) | 200 `{event}` | 404 |
| PATCH | `/api/events/{id}` | `events:write` | 200 `{event}` | 400 (incl. capacity below held seats); 401; 403; 404 |
| POST | `/api/events/{id}/tickets` | `bookings:create` | 201 `{ticket:Ticket}` with `qrToken` | 401; 403; 404; 409 `duplicate_ticket` · `sold_out` · `event_not_open` · `event_started` |
| POST | `/api/events/{id}/guest-tickets` `{name,email}` | public, same-origin | 201 `{ticket, url:"/t/{qrToken}"}` | 400; 403 cross-origin; 404; 409 `duplicate_ticket` · `sold_out` · `member_email` (sign in instead) |
| GET | `/t/{qrToken}` | public, token only | 200 `{ticket:PublicTicket}` | 404 |
| GET | `/api/tickets/mine` | signed in | 200 `{tickets:Ticket[]}` with `qrToken` | 401 |
| GET | `/api/events/{id}/holds` | `payments:confirm` | 200 `{holds:Ticket[]}` pending only, soonest expiry first | 401; 403; 404 |
| GET | `/api/events/{id}/tickets` | `payments:confirm` | 200 `{tickets:Ticket[]}` all statuses, full guest email | 401; 403; 404 |
| POST | `/api/tickets/{id}/confirm` `{reference}` | `payments:confirm` | 201 `{ticket,created:true}` · 200 `{ticket,created:false}` already paid | 400; 401; 403; 404; 409 `hold_expired` ("Hold expired, rebook") |
| POST | `/api/tickets/{id}/cancel` | owner of a pending ticket, or `payments:confirm` | 200 `{ticket}` (repeat is a no-op) | 401; 403; 404; 409 `hold_expired` · `refunds_out_of_scope` (paid) |
| POST | `/api/events/{id}/scan` `{credential}` | `tickets:check_in` | 200 `ScanResult` | 400; 401; 403; 404 event |
| GET | `/api/events/{id}/report` | `events:report` | 200 `EventReport` | 401; 403; 404 |

- **Pricing** is fixed at booking from `membershipState`: active members pay `memberPricePaise`, everyone else `guestPricePaise`. Guests book by name and email (normalised lower-case); an email that belongs to a club member is refused with `member_email`.
- **One live ticket** per member or guest email per event (`pending_payment` or `paid`), enforced by partial UNIQUE indexes. Cancelled and expired tickets do not block rebooking.
- **Seats**: `registered` is incremented with a conditional `UPDATE … WHERE registered < capacity` inside `BEGIN IMMEDIATE`, with no awaits; the last seat can never be sold twice. Zero-price tickets are `paid` at booking and post no ledger row.
- **Holds**: a pending ticket holds its seat for 30 minutes (`holdExpiresAt`). `releaseExpiredHolds()` runs inside the transaction before booking, confirmation, cancellation, scan, hold lists and the report; it marks lapsed holds `expired` and returns their seats exactly once. Indexes: `(event_id, status, hold_expires_at)`, `(status, hold_expires_at)`.
- **Confirmation** is the only income path: release expired holds, then one conditional `UPDATE … WHERE status = 'pending_payment'`, then exactly one `ticket` income row via `postLedgerEntry` with `recordedBy`. Expired or cancelled holds answer `409 hold_expired` and write nothing; a second confirmation of a paid ticket returns `200 created:false` and posts nothing. Refunds are out of scope, so paid tickets cannot be cancelled.
- **Door contract**: the scanner selects the event first, then sends a ticket QR token / short code or a member QR token / short code (never an id). A member resolves to their single live ticket for that event. Outcomes and the fixed messages:

| `outcome` | `message` | When |
|---|---|---|
| `admitted` | Admitted | paid, not yet scanned; `attendee:{name, membership}` where membership is `active|expired|none|guest` |
| `already_checked_in` | Already checked in | repeat scan; `checkedInAt` is the original timestamp |
| `payment_pending` | Payment pending | ticket still on hold |
| `not_valid` | Not valid for this event | unknown credential, other event, cancelled or expired ticket |
| `member_no_ticket` | Member, no ticket | active member pass, no live ticket here |
| `no_ticket_membership_expired` | No ticket · membership expired | expired or never-paid member pass, no live ticket here |

  Admission depends on the paid ticket, not on membership. Check-in is one conditional `UPDATE … WHERE status = 'paid' AND checked_in_at IS NULL`, so a repeat scan cannot admit twice.
- **Report**: `{event, tickets:{pendingPayment,paid,cancelled,expired}, ticketsSold, attendance, realizedRevenuePaise}` where revenue is the sum of `ticket` ledger rows for the event. The starter events' seeded `registered` counts are pre-system registrations and are not tickets.

## Merchandise orders, stock holds and fulfilment (#6, P3)

Schema v8 (v7 is reserved for Nitish's P5). `products` gains `clubId`, `description`, nullable `memberPricePaise` and `active`; `product_variants` holds one stock figure per size (the starter products get a single `ONE SIZE` variant with their seeded stock); `merch_orders` holds member orders with a 30-minute hold. `products.stock` is kept equal to the sum of its sizes for the dashboard.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/products` | public (organizers also see retired) | 200 `{products:ProductDetails[]}` | |
| POST | `/api/products` `{name,description?,pricePaise,memberPricePaise?,variants:[{size,stock}]}` | `products:write` | 201 `{product}` | 400 (incl. duplicate size); 401; 403 |
| GET | `/api/products/{id}` | public | 200 `{product}` | 404 |
| PATCH | `/api/products/{id}` `{active}` | `products:write` | 200 `{product}` | 400; 401; 403; 404 |
| PATCH | `/api/products/variants/{id}` `{stock}` | `products:write` | 200 `{product}` | 400; 401; 403; 404 |
| POST | `/api/orders` `{variantId, quantity?=1 (max 2)}` | `orders:create` (signed-in member) | 201 `{order:MerchOrder}` | 400; 401; 403; 404; 409 `out_of_stock` · `pending_limit` · `product_inactive` |
| GET | `/api/orders/mine` | signed in | 200 `{orders}` | 401 |
| GET | `/api/orders?status=` | `payments:confirm` or `orders:fulfil` | 200 `{orders}` (`pending_payment` = confirmation desk, soonest expiry first) | 400; 401; 403 |
| POST | `/api/orders/{id}/confirm` `{reference}` | `payments:confirm` | 201 `{order,created:true}` · 200 `{order,created:false}` already paid or fulfilled | 400; 401; 403; 404; 409 `hold_expired` ("Hold expired, reorder") |
| POST | `/api/orders/{id}/cancel` | owner of a pending order, or `payments:confirm` | 200 `{order}` (repeat is a no-op) | 401; 403; 404; 409 `hold_expired` · `refunds_out_of_scope` |
| POST | `/api/orders/{id}/fulfil` | `orders:fulfil` | 200 `{order}` (repeat is a no-op) | 401; 403; 404; 409 `order_not_paid` |

- **Identity**: ordering requires a session; guest orders are out of scope. A member may hold at most **two unpaid units per size** at a time (`pending_limit`); cancelling or paying frees the allowance.
- **Stock** is reserved with a conditional `UPDATE product_variants SET stock = stock - ? WHERE stock >= ?` inside `BEGIN IMMEDIATE`; zero stock and concurrent overselling both answer `409 out_of_stock`. `ProductVariant.stock` is therefore "available right now", holds already subtracted.
- **Pricing**: if the product has `memberPricePaise` and the member is `active` by `membershipState` at order time, `pricing:"member"` at that unit price; otherwise `standard`. The price is stored on the order and never recomputed. Zero-total orders are `paid` at creation and post no ledger row.
- **Holds**: `holdExpiresAt` is 30 minutes after creation. `releaseExpiredHolds()` runs inside the transaction before ordering, confirmation, cancellation, stock edits and every order list; it marks lapsed orders `expired` and returns their units exactly once (index `(status, hold_expires_at)`).
- **States**: `pending_payment → paid → fulfilled`, or `pending_payment → cancelled`, or `pending_payment → expired` by the clock. Confirmation releases expired holds, then one conditional `UPDATE … WHERE status = 'pending_payment'`, then exactly one `merch_order` income row via `postLedgerEntry` with `recordedBy`. Expired or cancelled orders cannot be revived and never produce income. Paid orders cannot be cancelled (refunds are out of scope).
- **Reconciliation**: `SOURCE_RESOLVERS.merch_order` resolves paid and fulfilled orders; `tests/ledger-reconciliation.test.ts` covers paid, held, expired and cancelled orders.

## Starter routes

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/health` | public | 200 `{status:"ok",database:"sqlite",schemaVersion:number}` | 503 `{status:"error",error}` |
| GET | `/api/dashboard` | public, richer when signed in | 200 `Dashboard` | 401 invalid bearer; 500 |
| GET | `/api/members` | `members:read` | 200 `{members:Member[]}` | 401; 403; 500 |
| POST | `/api/members` | `members:create` | 201 `{member:Member}` | 400 invalid/malformed; 401; 403; 409 duplicate email; 500 |

Create-member request stays `{"name","email"}`. Name is trimmed, 2–120 characters. Email is trimmed, validated, lowercased, at most 254 characters, and unique case-insensitively. A new member has `duesStatus:"unpaid"`, `expiresOn:null` and `role:"member"`; the officer who created it is recorded in the audit trail. Creating a member does not record a payment, activate benefits or grant a login.

`Dashboard` contains `club`, `metrics`, `members`, `events`, `announcements`, `products`, `tasks`, `transactions` and `access:{members:boolean,finance:boolean}`. Anonymous callers and plain members receive `members:[]`, `transactions:[]` and `balancePaise:0`; the `access` flags tell the UI which sections were withheld rather than empty. Anonymous dashboard responses also return tasks:[]; task details require a signed-in club member. Products are scoped to the current club. The active-member metric uses the shared membership predicate against today's Asia/Kolkata date, including memberships expiring today.

## Data and invariants

- Schema changes are versioned migrations in `src/lib/db/migrations.ts`, applied in one write transaction and recorded in `PRAGMA user_version`. `GET /api/health` reports the current version.
- Member email has a case-insensitive UNIQUE constraint. API validation is also enforced at the store boundary.
- Sessions store only a SHA-256 hash of the session token with `expires_at`/`revoked_at`.
- `audit_events` records who changed what, including member, dues, ticket, task and expense decisions.
- An event's `registered` count cannot exceed capacity. Booking and hold release update the count transactionally.
- Ledger amounts are positive integer paise; `kind` determines income versus expense. Balance is calculated on the server.
- Products are aggregate read-only examples until the merchandise ticket introduces size variants.

## Planned conventions

These are the ticket design constraints. The membership, ticket, task and reimbursement endpoints above and below implement the corresponding parts; merchandise and announcement workflows remain future work:

- Membership: define plans, free/paid status, benefit eligibility, renewal and idempotent dues recording in #4.
- Ticketing: reserve capacity atomically; issue tickets against confirmed states; reject duplicate check-in in #5.
- Merchandise: use per-size stock and idempotent order/payment confirmation in #6.
- Treasury: distinguish requested, approved and paid reimbursements; trace each source transaction once in #7.
- Announcements: distinguish draft, publication and notification delivery; local outbox is not actual delivery in #8.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Secrets and demo credentials live in environment configuration, never in code.

## Local demo clock

`MODE_DEMO_NOW=<ISO timestamp>` freezes the server clock so expiry, reminders and deadlines can be demonstrated deterministically. Tests use an injected clock instead of this variable.

## Tasks, expenses and receipts (schema v9)

All endpoints below require a session. Cookie mutations also enforce same-origin requests; valid bearer sessions retain the native authentication contract.
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
| GET | `/api/ledger/export` | ledger:read | CSV with user text formula-escaped and numeric amount cells |
| GET | `/api/events/{id}/report` | events:report | Existing ticket report plus WorkspaceEventReport fields |

Task creation takes `{title,description?,assigneeId?,eventId?,dueAt?}`. PATCH permits the same optional fields, with null to clear description, assignee, event or deadline. Status takes `{status:"todo"|"in_progress"|"done"}`. Deadlines normalize to UTC. Assignment and event references must belong to the caller's club; mine uses the actual session member.

Expense submission takes `{amountPaise,purpose,receiptId?,receiptReference?,eventId?}`. Amounts must be positive safe integer paise. Receipt ownership is checked; one member cannot submit another member's receipt. Approve takes `{}`, reject takes `{note?}`, and pay takes `{paymentReference}`. No uploader, submitter or reviewer identity fields are accepted in JSON; multipart uploader fields are ignored.

An expense moves submitted → approved/rejected, then approved → paid. Officers cannot review or pay their own expenses. Payment takes a database write lock before reading state, updates the expense and posts one source-linked transaction atomically. Repeating the same payment reference returns the paid expense without another outflow; a different reference conflicts. Payment records a reimbursement already made externally; it does not transfer money.

The existing `transactions` ledger remains the single source of balances, including pre-system opening balances. There is no second expense ledger. Expense sources participate in reconciliation. Task changes and expense decisions are audited.

Receipts accept JPEG, PNG, WebP or PDF with checked signatures, at most 2 MiB. Uploads use a multipart field named `file`; oversized files return 413 and unsupported signatures return 415. Files live in the receipts directory beside SQLITE_PATH; failed database inserts remove their new file. Missing files return 404. Back up SQLite and this directory together.

Errors use 400 for invalid bodies, 401 for absent/expired sessions, 403 for role/ownership/origin failures, 404 for missing or foreign-club records, and 409 for invalid transitions. Schema v9 upgrades the released v1–v8 history without replacing existing members, sessions, passes or opening balances. Databases made by the earlier unmerged PR's conflicting schema are not a supported migration source.

The event report preserves ticket counts, attendance and realized revenue, and adds fundraiser progress and task counts. Ticket receipts, dues and merchandise income remain in the same ledger; the new migration backfills their club metadata and ticket event attribution. Treasury entries retain their external payment references. Reserved schema gaps remain skipped; v9 follows the already released v8.

EXPO_PUBLIC_API_URL remains configuration for a future Expo client. Browser sign-in and native bearer authentication exist, but the Expo UI is not included. MODE_CORS_ORIGINS follows the development-only policy above.

### Authentication status

The workspace uses the existing HttpOnly cookie session for browsers. Native callers can use the existing bearer token returned by login; role and club checks are identical.
