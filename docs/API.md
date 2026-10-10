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

## Event booking, member pricing and check-in (#5)

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/events` | public (organizers also see drafts) | 200 `{events:EventDetails[]}` | 500 |
| POST | `/api/events` | `events:write` | 201 `{event}` | 400; 401; 403 |
| GET | `/api/events/{id}` | public for published | 200 `{event}` | 404 |
| PATCH | `/api/events/{id}` | `events:write` | 200 `{event}` | 400 capacity below held seats; 401; 403; 404 |
| POST | `/api/events/{id}/bookings` | `bookings:create` (any member) | 201 `{booking}` | 401; 404; 409 `sold_out` · `duplicate_booking` · `event_not_open` · `event_started` |
| GET | `/api/bookings` | signed in | 200 `{bookings:Booking[]}` | 401 |
| POST | `/api/bookings/{id}/confirm` | `payments:confirm` | 201 ticket issued · 200 same reference replayed `{booking,created}` | 400 wrong amount; 401; 403; 404; 409 `reservation_not_active` · `already_confirmed` · `payment_reference_reused` |
| POST | `/api/bookings/{id}/cancel` | owner or `events:write` | 200 `{booking}` | 401; 403; 404; 409 expired or already used |
| POST | `/api/tickets/{code}/check-in` | `tickets:check_in` | 200 `{booking,attendee,checkedInAt}` | 401; 403; 404 unknown code; 409 `ticket_not_valid` · `already_checked_in` |
| GET | `/api/events/{id}/report` | `events:report` | 200 `{report:EventReport}` | 401; 403; 404 |

Event body: `{title, description?, startsAt (ISO), venue, capacity, memberPricePaise, guestPricePaise, status?}`. Confirm body: `{paymentReference, amountPaise}`.

- **Pricing** is decided by the server at booking time from the shared membership rule: active paid members pay `memberPricePaise`, everyone else (including expired members) pays `guestPricePaise`. The client never sends a price.
- **Capacity** is reserved transactionally: `UPDATE events SET registered = registered + 1 WHERE registered < capacity` inside an immediate transaction, backed by the `registered <= capacity` CHECK constraint. Concurrent requests for the last seat get exactly one `201` and the rest `409 sold_out`.
- **Reservation hold**: priced seats are `reserved` for 30 minutes (`reservedUntil`). Lapsed holds become `expired` and free their seat on the next booking, confirmation or report. Free seats are `confirmed` immediately.
- **Tickets** (`ticketCode`, format `MODE-XXXX-XXXX`) exist only on `confirmed` bookings. A payment screenshot is not verification; an officer with `payments:confirm` records the reference. The reference is unique per club; replaying it returns the same ticket, reusing it on another booking is rejected, and the ledger receives exactly one `ticket` income row per payment, tagged with the event.
- **Check-in** records one row per booking (primary key), so a second scan is `409 already_checked_in` with the original time. Cancelled, reserved and expired tickets are `409 ticket_not_valid`; unknown codes are `404`. Used tickets cannot be cancelled.
- **Reports** return held/confirmed/cancelled/expired counts, check-ins, event income from the ledger and the confirmed attendee list with check-in time.
- Paid cancellations release the seat and are audited as paid; refunds are a treasury decision outside this ticket.

## Merchandise variants, orders and stock-safe checkout (#6)

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/products` | public (organizers also see inactive) | 200 `{products:ProductDetails[]}` | 500 |
| POST | `/api/products` | `products:write` | 201 `{product}` | 400 duplicate size; 401; 403 |
| PATCH | `/api/products/variants/{id}` | `products:write` | 200 `{product}` | 400; 401; 403; 404 |
| GET | `/api/orders` · `?scope=club` | signed in · `orders:fulfil` | 200 `{orders:Order[]}` | 401; 403 |
| POST | `/api/orders` | `orders:create` (any member) | 201 `{order}` | 400; 401; 404 size; 409 `out_of_stock` · `product_inactive` |
| POST | `/api/orders/{id}/confirm` | `payments:confirm` | 201 paid · 200 same reference replayed `{order,created}` | 400 wrong amount; 401; 403; 404; 409 `already_paid` · `order_cancelled` · `payment_reference_reused` |
| POST | `/api/orders/{id}/cancel` | owner (unpaid) or `products:write` | 200 `{order}` | 401; 403 paid order by member; 404; 409 `order_fulfilled` |
| POST | `/api/orders/{id}/fulfil` | `orders:fulfil` | 200 `{order}` | 401; 403; 404; 409 `order_not_paid` |

Product body: `{name, description?, pricePaise, memberPricePaise?|null, variants:[{size, stock}]}`. Order body: `{variantId, quantity?}` (1–20). Confirm body: `{paymentReference, amountPaise}`.

- **Variants** carry the stock; `Product.stock` is kept equal to the sum of its sizes so the starter dashboard keeps working. Starter products were split into S/M/L/XL with the same totals.
- **Reservation** is `UPDATE product_variants SET stock = stock - q WHERE id = ? AND stock >= q` inside an immediate transaction, backed by the `stock >= 0` CHECK. Concurrent orders for the last unit get exactly one `201`; the rest are `409 out_of_stock`. Other sizes are unaffected.
- **Pricing** uses the shared membership rule: active paid members pay `memberPricePaise` when the product defines one, otherwise `pricePaise`. The server fixes `unitPricePaise` and `totalPaise` at order time.
- **States** are explicit: `status` is `pending_payment` → `paid` → (`cancelled`), `fulfilment` is `unfulfilled` → `fulfilled`. Zero-total orders are `paid` immediately.
- **Payment** confirmation records the reference once (unique per club), replays safely, and posts exactly one `merchandise` ledger income row per payment.
- **Cancellation** returns the quantity to the same size, is idempotent, and is audited with whether the order was paid; refunds of paid orders are a treasury action. Fulfilled orders cannot be cancelled.

## Club ledger, receipts and reimbursements (#7)

The ledger is the single `transactions` table. Every realized cash movement is one row that names its originating record once (`sourceType` + `sourceId` are UNIQUE), so membership dues, tickets, merchandise and reimbursement payouts can never post twice. Balance is always computed from the rows, never stored.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| GET | `/api/ledger/summary` | `ledger:read` | 200 `{summary:LedgerSummary}` | 401; 403 |
| GET | `/api/ledger/entries?category=&eventId=` | `ledger:read` | 200 `{entries:LedgerEntry[]}` | 400; 401; 403 |
| GET | `/api/ledger/export` | `ledger:read` | 200 `text/csv` attachment | 401; 403 |
| POST | `/api/receipts` (multipart, field `file`) | `expenses:submit` | 201 `{receipt:Receipt}` | 400 no file; 401; 413 over 2 MB; 415 not JPEG/PNG/WebP/PDF |
| GET | `/api/receipts/{id}` | uploader or `expenses:review` | 200 file bytes | 401; 403; 404 |
| GET | `/api/expenses?status=` | signed in (own) · `expenses:review` (all) | 200 `{expenses:ExpenseRequest[]}` | 401 |
| POST | `/api/expenses` | `expenses:submit` | 201 `{expense}` | 400 non-positive amount / no receipt; 401; 403 receipt not yours; 404 event or receipt; 409 `duplicate_receipt` |
| POST | `/api/expenses/{id}/approve` · `/reject` | `expenses:review` | 200 `{expense}` | 401; 403 own request; 404; 409 `expense_not_pending` |
| POST | `/api/expenses/{id}/pay` | `expenses:review` | 201 paid · 200 same reference replayed `{expense,created}` | 400; 401; 403; 404; 409 `expense_not_approved` · `already_paid` · `payment_reference_reused` |

Expense body: `{amountPaise, purpose, receiptId? | receiptReference?, eventId?}`. Decision body: `{note?}`. Payout body: `{paymentReference}`.

- **States are distinct**: `submitted` → `approved` | `rejected`, and `approved` → `paid`. Submission and approval never touch the ledger; only `pay` writes the `reimbursement` expense row. `LedgerSummary.approvedUnpaidPaise` shows committed-but-unrealized cash separately from `balancePaise`.
- **Separation of duties**: reviewers cannot approve, reject or pay their own requests. Every decision is audited (`expense.submitted/approved/rejected/paid`) with the actor, time and note.
- **Receipts** are stored outside the web root under the database directory (`.data/receipts/<club>/<uuid>.<ext>`, gitignored), with size ≤ 2 MB, an allow-listed MIME type, a SHA-256 fingerprint and a sanitised display name. They are streamed only to the uploader or a reviewer with `nosniff` and no caching. One receipt can back only one expense request.
- **Reconciliation**: `summary` returns inflow, outflow, balance, per-category totals and a per-event breakdown (`inflow`, `outflow`, `net`) joining ticket income and event-tagged expenses. The dashboard balance and the ledger summary are computed from the same rows. `export` is a plain CSV of all entries.
- Approved institution-approved payment channels are just the `paymentReference` string (UPI id, bank reference, cash voucher) and stay configurable by the club.

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
- `events.registered` counts held seats (reserved + confirmed) and cannot exceed capacity; `check_ins.booking_id` is the primary key so a ticket can be used once.
- Ledger amounts are positive integer paise; `kind` determines income versus expense; `category` is one of membership, ticket, merchandise, reimbursement, other. Balance is calculated on the server.
- `expense_requests.receipt_id` is UNIQUE and `(club_id, payment_reference)` is UNIQUE, so a receipt backs one request and a payout reference is used once.
- `product_variants(product_id, size)` is UNIQUE with `stock >= 0`; `products.stock` mirrors the sum of its variants.

## Planned conventions

These are design constraints for future tickets, not implemented endpoints:

- Announcements: distinguish draft, publication and notification delivery; local outbox is not actual delivery in #8.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Secrets and demo credentials live in environment configuration, never in code.

## Local demo clock

`MODE_DEMO_NOW=<ISO timestamp>` freezes the server clock so expiry, reminders and deadlines can be demonstrated deterministically. Tests use an injected clock instead of this variable.
