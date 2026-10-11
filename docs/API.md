# MODE API contracts

The implemented types are authoritative in `src/lib/contracts.ts`. The backend owner is Divyank; contract/integration owner is Nitish; Azman consumes these shapes. Changes must update types, this document and related ticket acceptance tests together.

## Conventions

- All routes run on Node.js and use the SQLite/PostgreSQL adapter selected by `src/lib/database.ts`. `DATABASE_URL` selects PostgreSQL; otherwise SQLite is used. Responses carry `Cache-Control: no-store`.
- Money fields ending in `Paise` are integer paise. ISO timestamps are UTC; date-only fields (`expiresOn`) are club calendar days in Asia/Kolkata.
- Errors are `{error:string, code?:string, details?:[{field,message}]}`. No database paths or stack traces reach the client.
- `401 unauthenticated` means no valid selected session. `403 forbidden` means the session exists but the role lacks the permission, or a cookie-authenticated write arrived cross-origin.
- Cookie-authenticated writes (POST/PATCH/DELETE) enforce same-origin: an `Origin` header, when present, must match `MODE_PUBLIC_ORIGIN` when configured, otherwise the direct request scheme and host. `Sec-Fetch-Site` must not be `cross-site`. Only an authenticated bearer request bypasses this check. Login and registration always enforce the same-origin check; native clients omit browser origin headers.

## Version 2 paginated lists

These authenticated GET routes return `CursorPage<T>`: `{items:T[], nextCursor:string|null, hasMore:boolean}`. The last page returns `nextCursor:null` and `hasMore:false`; an empty list also returns `items:[]`. Existing unversioned routes retain their current full-list response shapes. `/api/ledger/summary`, both ledger CSV exports and event finance totals continue to use all authorized matching records.

| Path | Item type | Access | Default and only supported `sort` | Additional filters |
|---|---|---|---|---|
| `/api/v2/members` | `Member` | `members:read`, own club | `joinedAt_desc` | `role`, `membership` (`active`, `expired`, `none`) |
| `/api/v2/tasks` | `TaskDetails` | signed-in member, own club | `createdAt_desc` | `status` (`todo`, `in_progress`, `done`), `assigneeId`, `eventId`, `mine`, `overdue` |
| `/api/v2/expenses` | `Expense` | `expenses:submit`; own claims unless `expenses:review`, own club | `submittedAt_desc` | `status` (`submitted`, `approved`, `rejected`, `paid`), `submitterId`, `eventId` |
| `/api/v2/ledger/entries` | `ExpenseLedgerEntry` | `ledger:read`, own club | `occurredAt_desc` | `kind` (`income`, `expense`), `eventId`, `category` (`membership`, `events`, `expense`, `merch_order`, `opening_balance`) |

All four accept `limit`, `cursor`, `q` and `sort`. `limit` defaults to 25 and must be an integer from 1 through 100; values outside that range are rejected with `400 validation_failed`. Each query parameter may appear once. Unknown parameters, unsupported sort/filter values, empty filters and malformed cursors also return 400. IDs accept 1–100 nonblank characters, including existing `demo-*` IDs and UUIDs. Boolean filters must be `true` or `false`. `mine=true` and `assigneeId` cannot be combined. A non-reviewer filtering expenses by another submitter receives an empty page, because the owner restriction is applied independently.

`q` is a trimmed literal substring of 1–200 characters. Search text and ID filters reject NUL with 400. Members search name/email, tasks search title/description, expenses search purpose and ledger searches description. ASCII letters match without case sensitivity on both engines; non-ASCII characters match literally without case folding. `%`, `_` and backslash are literal search characters. Category `membership` maps to dues payments and `events` maps to ticket income.

Ordering is the listed timestamp **descending**, followed by the immutable record ID **ascending** to break ties. Each SQL query applies club, permissions/ownership, search and filters before fetching at most `limit + 1` rows. Migration 14 adds composite indexes for the base lists and common owner/assignee/status filters, retaining migration 13's data hardening. Only the requested page is materialized by these v2 list methods.

Send `nextCursor` unchanged on the next request with the same endpoint, sort and filters. Cursors are signed and bound to the login session, member, club and role. Cross-list/filter/session use and altered cursors return 400; restart without a cursor after changing filters or login. `limit` may change between pages. The first page's clock is retained for overdue and membership classification. This is a live keyset list, not a database snapshot: exactly-once traversal applies to a fixed dataset; concurrent edits/deletions or newly matching rows require refresh when a complete current view is needed.

Ledger summary uses full-set SQL aggregates for totals, categories and events; it does not materialize individual ledger entries or inherit a list cursor/limit. CSV continues to export the full authorized ledger.

Both database adapters use these queries. CI includes a serialized test job against a disposable PostgreSQL database; successful execution is required before merge. Local SQLite verification does not establish PostgreSQL query plans, concurrent-write capacity or hosted readiness.

## Identity and roles (#3)

Authentication uses an HS256-signed JWT in the `mode_session` cookie (`HttpOnly; SameSite=Lax; Path=/`, `Secure` on HTTPS). JWTs last 7 days. Each JWT is also bound to a database session by its SHA-256 hash, session ID, member ID and club ID, so logout and revocation take effect immediately. Passwords are stored as salted scrypt hashes. Every member belongs to exactly one club; all reads and writes are scoped to the caller's club.

The JWT contains `iss=mode`, `aud=mode-api`, `sub` (member ID), `jti` (unique session ID), `clubId`, `iat` and `exp` (UTC epoch seconds). The server verifies the HMAC-SHA256 signature with a constant-time comparison, the fixed algorithm, issuer, audience, required claims and expiry before resolving the database session. Permissions come from the current database role; the JWT does not contain passwords, email, names or roles. This is a signed token, not encrypted data. Legacy opaque session tokens are rejected; existing users must sign in again after this change.

Run `npm run auth:setup` once locally to generate a private `MODE_JWT_SECRET` in ignored `.env.local`, then restart the server. Every deployment must configure its own secret: exactly 64 hexadecimal characters representing 32 random bytes, shared by all server replicas. Never use `NEXT_PUBLIC_` or `EXPO_PUBLIC_` for the key. Missing or malformed keys fail closed. Changing the key invalidates all existing JWTs. See [JWT authentication](AUTHENTICATION.md) for setup, flow and verification instructions.

Native clients may instead send `Authorization: Bearer <token>` using the token returned by login or registration. This references the same session row as the cookie. Whenever `Authorization` is present, the cookie is ignored: malformed, unknown, expired and revoked bearer tokens return 401, including on the optional-auth dashboard and logout. Valid bearer requests still enforce role permissions. Logout revokes only the selected session; the token and cookie for that session both stop working. Bearer logout sends no `Set-Cookie`, preserving unrelated browser cookies; cookie logout clears the browser session cookie.

### Rate limiting and overload

The first local admission controls apply bounded in-memory token buckets per process. `/api/workspace/summary` allows a burst of 5 per account and refills at 30/minute, with a club budget of 42,000/minute and burst 700. `/api/workspace/search` allows a burst of 6 per account and refills at 30/minute, with a club budget of 3,000/minute and burst 100. Login has a broad source budget plus an email failure budget; successful authentication refunds the email token, while the durable five-failure SQL lockout remains authoritative.

Policy exhaustion returns `429 {error,code:"rate_limited"}` with `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`. Server admission exhaustion returns `503 {error,code:"server_busy"}` with `Retry-After`. Both responses are `Cache-Control: no-store`. Web GETs retry these responses at most twice with capped exponential backoff and jitter; mutations are never automatically replayed. In-memory limits coordinate one process only. The hosted multi-instance design requires the atomic Redis backend described in [the rate-limit and queue plan](performance/RATE-LIMIT-QUEUE-PLAN.md).

Every API route wrapped by `route()` returns a server-generated `X-Request-Id`; error JSON repeats it as `requestId`. Expected domain errors retain their stable status/code. Unexpected exceptions return `500 {error:"Something went wrong. Please try again.",code:"internal_error",requestId}` while the internal message and stack appear only in the structured server log. The web client applies a 15-second timeout, rejects malformed success responses, retries GET failures within a bounded budget, and reports a lost mutation response as an uncertain outcome without replaying it. See [exception handling and recovery](EXCEPTION-HANDLING.md).

Web clients use the HttpOnly cookie and do not persist the response token in browser storage. The Expo native client uses `expo-secure-store`; its exported web app uses the Next host for same-origin cookies. Physical-device and installed-PWA acceptance remains tracked under #10/#14.

### Development CORS

For HTTPS termination at a reverse proxy, set `MODE_PUBLIC_ORIGIN=https://your-public-host` on the API server. It must be an exact HTTP(S) origin without credentials, trailing slash, path, query or fragment. This configuration pins the accepted browser origin even when the proxy uses an internal HTTP Host, and HTTPS configuration makes session cookies Secure. Invalid configuration fails closed. Forwarded headers cannot authorize another origin. Leave it unset for the normal direct localhost/LAN development setup.

`src/proxy.ts` applies to `/api/:path*`. Only `NODE_ENV=development` enables the optional `MODE_CORS_ORIGINS` comma-separated allowlist of HTTP(S) origins, for example `http://localhost:8081,http://127.0.0.1:8081`. Configured trailing slashes normalize to the origin; non-root paths, credentials, queries, hashes, wildcards and `null` origins are ignored. Request origins must match a normalized allowlist entry exactly. Production ignores this configuration.

An allowed preflight returns 204 and advertises GET, HEAD, POST, PATCH, DELETE and OPTIONS with Content-Type/Authorization headers. Denied origins, methods or headers get 403 without ACAO. Actual responses grant ACAO only to allowed origins and vary by Origin; credentialed cross-origin cookies are not enabled. Native requests without Origin continue normally.

CORS does not authorize a request or relax cookie CSRF protection. Even an allowlisted browser origin cannot log in or perform cookie-authenticated mutations cross-origin. Native clients obtain a token through login without browser origin headers; cross-origin bearer API calls still require that valid token and the route's permission. The Expo web app uses same-origin login/cookies when served by the Next host.

| Method | Path | Permission | Success | Failure |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | 201 `AuthResponse` + cookie | 400 invalid or missing/outdated privacy acknowledgement; 403 cross-origin; 409 duplicate email |
| GET | `/api/privacy-policy` | public | 200 `PrivacyPolicyResponse` | 500 unexpected failure |
| POST | `/api/auth/login` | public | 200 `AuthResponse` + cookie | 400 invalid; 401 wrong email/password (same message for both); 403 cross-origin; 429 `too_many_attempts` after 5 consecutive failures for an email (15-minute lock) |
| POST | `/api/auth/password` | signed in, same-origin | 200 `{ok:true, revokedSessions}`; body `{currentPassword, newPassword}`; keeps this session, signs out every other one | 400 invalid; 401 current password wrong; 403 cross-origin |
| POST | `/api/auth/logout` | cookie logout is idempotent; bearer must be valid | 200 `{ok:true}`; cookie auth also clears cookie | 401 invalid bearer; 403 cross-origin cookie request |
| GET | `/api/auth/me` | signed in | 200 `{user:SessionUser,pass:{qrToken,shortCode,membership,expiresOn},memberships:ClubMembership[]}` | 401 |
| POST | `/api/auth/switch-club` | signed in, same-origin (or bearer) | 200 same shape as `/api/auth/me` for the new active club; body `{clubId}`; re-points this session only and writes `session.club_switched` to the target club's audit trail | 400 invalid; 401; 403 not a member of that club or cross-origin |
| GET | `/api/clubs/join-code` | `roles:manage` | 200 `{clubId, joinCode}` for the active club; `joinCode: null` means joining by code is off (the default) | 401; 403 |
| POST | `/api/clubs/join-code` | `roles:manage`, same-origin (or bearer) | 200 `{clubId, joinCode}` with a new 8-character Crockford code; the previous code stops working at once; audited `club.join_code_rotated` | 401; 403 |
| DELETE | `/api/clubs/join-code` | `roles:manage`, same-origin (or bearer) | 200 `{clubId, joinCode: null}`; joining by code is off; audited `club.join_code_disabled` | 401; 403 |
| POST | `/api/clubs/join` | signed in, same-origin (or bearer) | body `{joinCode}` (case, spaces, hyphens and O/0, I/L/1 are forgiven); 201 `{membership, rejoined: false}` as a plain `member`; 200 `{membership, rejoined: true}` when a person who left returns (same membership row, role reset to `member`). The session stays on its club; use `switch-club` to open the new one | 400 invalid; 401; 404 unknown or disabled code (one message for both); 409 already a member |
| POST | `/api/clubs/{id}/leave` | signed in, same-origin (or bearer) | 200 `{clubId, activeClubId, signedOut}`. Any of the person's clubs can be left. The membership keeps its history (tickets, orders, dues, claims, ledger) but leaves the roster, door, announcements, renewals, switching and sign-in; every other session on it ends. Leaving the session's own club moves it to the most recently used remaining club, or signs out (cookie cleared) when none remain | 401; 403 cross-origin; 404 not a current member; 409 `last_admin` |
| PATCH | `/api/members/{id}/role` | `roles:manage` | 200 `{member:Member}` | 400 unknown role; 401; 403; 404 not in this club; 409 changing own role |
| POST | `/api/members/{id}/password` | `roles:manage` | 200 `{ok:true}` | 400 password under 8 or over 200 characters; 401; 403 (also cross-origin); 404 not in this club |

Request bodies:

```json
{"name":"Demo Student","email":"student@example.com","password":"at least 8 characters","privacyPolicyVersion":"2026-10-11"}
{"email":"student@example.com","password":"..."}
{"role":"treasurer"}
```

`SessionUser` is `{id,name,email,role,clubId,permissions:string[]}`. The UI should drive navigation from `permissions`, not from role names, so the matrix can evolve without screen changes. `AuthResponse` is `{user:SessionUser, expiresAt, token}`. Auth responses use `Cache-Control: no-store`.

Self-registration requires the exact current `privacyPolicyVersion` after the user acknowledges the notice. Missing, false or outdated values return 400 with field `privacyPolicyVersion`. Registration writes `member.privacy_acknowledged` (entity ID = new member ID, details = `{policyVersion}`, timestamp = server clock) in the same transaction as the account and session. Existing/imported accounts are not silently marked as having acknowledged the policy. This acknowledgement does not grant camera, file, notification or optional-storage permissions.

`GET /api/privacy-policy` returns `{version,effectiveDate,organization,contactEmail,localContact,sections:[{title,text}]}` without authentication. It contains public notice text only. The `/privacy` web page renders the same source. `MODE_PRIVACY_ORGANIZATION` and `MODE_PRIVACY_EMAIL` configure the public operator details; defaults are labelled local-demo examples. See [privacy implementation](PRIVACY.md).

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

The `/app` web workspace shows each role a visibly different slice (`src/app/app/_lib/access.ts`): members see Announcements, Events, Merchandise and My tickets; volunteers see the Door scanner, Tasks, Announcements and My Expenses; treasurers see Overview, Members, Events (desks and reports), Merchandise (orders desk), Expenses (review), Treasury and Announcements; organizers see everything except Treasury; the admin sees everything. Everyone keeps My pass, Notifications and Settings. Inside each section the controls follow the permission matrix above, which the server still enforces on every request.

Announcement publication and outbox inspection use the permissions above. Implemented membership, ticket, merchandise, task, reimbursement and announcement routes are documented below.

### Demo accounts

Schema v2 seeds four synthetic officer accounts in the sample club: `lead@example.com` (admin), `organizer@example.com`, `treasurer@example.com`, `volunteer@example.com`. Their shared password is `MODE_DEMO_PASSWORD` (default `mode-demo-2026` in development only; production refuses to start a new database without it). The three starter members have no password until an admin sets one with `POST /api/members/{id}/password` (audited as `member.password_set`). No record contains real student information.

Production also rejects explicitly setting the public default and refuses to open an existing database while any of the six seeded officer/member accounts still uses that password. Changing `MODE_DEMO_PASSWORD` or `MODE_SEED` does not rotate stored credentials. Before promoting an existing demo database, use a private local maintenance environment to reset every synthetic account through the admin password operation, which revokes its old sessions. Use `MODE_SEED=none` and `npm run club:init` for a fresh real club. The startup guard checks known synthetic account IDs; it is not a general password-strength check for all members.

## P0 foundations (#2)

- **Membership state** is one function, `membershipState(member, clubDate(now))` in `src/lib/modules/membership-state.ts`: `active` when `expiresOn >= ` the Asia/Kolkata date, `expired` when it has passed, `none` when null. Its SQL twin `MEMBERSHIP_ACTIVE_SQL` / `MEMBERSHIP_STATE_SQL` is used for counts and filters; tests prove JS and SQL agree on today, yesterday and null. `Member.membership` carries the derived value; `duesStatus` is a historical flag, not an eligibility rule.
- **Member pass**: every member has a unique 128-bit base64url `qrToken` and a unique 10-character Crockford base32 `shortCode` (bounded collision retry, max 5). `GET /api/auth/me` returns `pass:{qrToken,shortCode,membership,expiresOn}` to the member themselves; `Member` exposes `shortCode` only. Door scanning resolves a pass by token or code, never by sequential id (`findMemberByPass`).
- **Ledger**: `transactions` gains `sourceType`, `sourceId`, `recordedBy` with a UNIQUE index on the source pair. The three starter rows are backfilled as `opening_balance` entries with "Opening balance (pre-system): …" descriptions. Financial modules call `postLedgerEntry()` inside the same transaction as the source transition; it rejects non-positive or non-integer paise and a second post for the same source.
- **Reconciliation**: `reconcileLedger(db)` reports balance, opening balances, duplicates, unsourced rows and orphans (rows whose source no longer resolves). It also walks dues, paid tickets, paid/fulfilled merchandise and paid expenses: `missing` identifies money sources without a ledger row; `mismatched` identifies inconsistent amount, direction, club or officer attribution. Free tickets/orders and unpaid sources require no entry. Expenses retain their paying officer in the ledger; the claim's reviewer may be different. A clean report requires every anomaly array to be empty and `unsourced` to be zero. New financial modules must extend both `SOURCE_RESOLVERS` and the source enumeration in `reconcileLedger`, with missing/mismatched-source coverage.
- **Demo accounts**: `active@example.com` (membership active, expires in 300 days) and `expired@example.com` (expired 10 days ago), password `MODE_DEMO_PASSWORD`, join the four officer accounts. The current schema version is 13.

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
| POST | `/api/events/{id}/guest-tickets` `{name,email}` | public for paid tickets; `events:write` for free guests; same-origin | 201 `{ticket, url:"/t/{qrToken}"}` | 400; 401 invalid bearer; 403 cross-origin; 404; 409 `duplicate_ticket` · `sold_out` · `member_email` · `guest_verification_required` |
| GET | `/t/{qrToken}` | public, token only | 200 HTML when Accept includes `text/html`; otherwise `{ticket:PublicTicket}` JSON | 404 |
| GET | `/api/tickets/mine` | signed in | 200 `{tickets:Ticket[]}` with `qrToken` | 401 |
| GET | `/api/events/{id}/holds` | `payments:confirm` | 200 `{holds:Ticket[]}` pending only, soonest expiry first | 401; 403; 404 |
| GET | `/api/events/{id}/tickets` | `payments:confirm` | 200 `{tickets:Ticket[]}` all statuses, full guest email | 401; 403; 404 |
| POST | `/api/tickets/{id}/confirm` `{reference}` | `payments:confirm` | 201 `{ticket,created:true}` · 200 `{ticket,created:false}` already paid | 400; 401; 403; 404; 409 `hold_expired` ("Hold expired, rebook") |
| POST | `/api/tickets/{id}/cancel` | owner of a pending ticket, or `payments:confirm` | 200 `{ticket}` (repeat is a no-op) | 401; 403; 404; 409 `hold_expired` · `refunds_out_of_scope` (paid) |
| POST | `/api/events/{id}/scan` `{credential}` | `tickets:check_in` | 200 `ScanResult` | 400; 401; 403; 404 event |
| GET | `/api/events/{id}/report` | `events:report` | 200 `EventReport` | 401; 403; 404 |

- **Pricing** is fixed at booking from `membershipState`: active members pay `memberPricePaise`, everyone else `guestPricePaise`. Guests book by name and email (normalised lower-case); an email that belongs to a club member is refused with `member_email`.
- **Free guests** need an organizer (`events:write`) from the same club to issue their ticket. Anonymous and ordinary-member attempts return `409 guest_verification_required` without reserving a seat. This prevents invented email addresses from bypassing unpaid-hold limits. Members still book their own free tickets; verified free guests remain paid immediately without a ledger entry.
- **Fundraising**: event create accepts optional `fundraiserGoalPaise` (default 0), PATCH accepts it when changing the target, and `EventDetails` returns it. It must be a nonnegative safe integer. Zero means no target, with report `onTrack:false`; the web form accepts rupees. The existing database column is reused, so no migration or history rewrite is needed.
- **Availability reads**: event list and detail release lapsed holds before returning counts. Active holds remain occupied; cleanup only takes a write lock when a hold has expired.
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
| GET | `/api/health` | public, admission bypass | 200 `{status:"ok",database:"sqlite",schemaVersion:number}` | 503 `server_busy` with resource `database` |
| GET | `/api/dashboard` | public, richer when signed in | 200 `Dashboard` | 401 invalid bearer; 500 |
| GET | `/api/workspace/summary` | signed in | 200 `WorkspaceChromeSummary` with club identity and member/task/unread counts | 401; 500 |
| GET | `/api/workspace/search?q=...` | signed in | 200 `{results:WorkspaceSearchResult[]}`; 2–100 literal characters, at most 6 results | 400; 401; 500 |
| GET | `/api/members` | `members:read` | 200 `{members:Member[]}` | 401; 403; 500 |
| POST | `/api/members` | `members:create` | 201 `{member:Member}` | 400 invalid/malformed; 401; 403; 409 duplicate email; 500 |

Create-member request stays `{"name","email"}`. Name is trimmed, 2–120 characters. Email is trimmed, validated, lowercased, at most 254 characters, and unique case-insensitively. A new member has `duesStatus:"unpaid"`, `expiresOn:null` and `role:"member"`; the officer who created it is recorded in the audit trail. Creating a member does not record a payment, activate benefits or grant a login.

`Dashboard` contains `club` (`{name, description, demo}`; `demo` is true while the fictional starter records are present, see "Real club data" in the README), `metrics`, `members`, `events`, `announcements`, `products`, `tasks`, `transactions` and `access:{members:boolean,finance:boolean}`. Anonymous callers and plain members receive `members:[]`, `transactions:[]` and `balancePaise:0`; the `access` flags tell the UI which sections were withheld rather than empty. Anonymous dashboard responses also return tasks:[]; task details require a signed-in club member. Products are scoped to the current club. The active-member metric uses the shared membership predicate against today's Asia/Kolkata date, including memberships expiring today.

`WorkspaceChromeSummary` is the small polling contract used by persistent navigation: `{club:{name,demo},counts:{members,tasks,completedTasks,unreadNotifications}}`. It computes counts in SQL and never returns member, task or notification collections. Workspace search runs only on demand, treats `%`, `_` and `\` as literal text, scopes every query to the actor's club, and omits member/email results unless the actor has `members:read`.

## Data and invariants

- Schema changes are versioned migrations in `src/lib/db/migrations.ts`, applied in one write transaction and recorded in `PRAGMA user_version`. `GET /api/health` reports the current version.
- Member email has a case-insensitive UNIQUE constraint. API validation is also enforced at the store boundary.
- Sessions store only a SHA-256 hash of the session token with `expires_at`/`revoked_at`.
- `audit_events` records who changed what, including member, dues, ticket, task and expense decisions.
- An event's `registered` count cannot exceed capacity. Booking and hold release update the count transactionally.
- Ledger amounts are positive integer paise; `kind` determines income versus expense. Balance is calculated on the server.
- Products expose per-size inventory through the merchandise endpoints; the dashboard stock total aggregates the available variant quantities.

## Planned conventions

These are the ticket design constraints. The membership, ticket, merchandise, task, reimbursement and announcement endpoints implement the corresponding parts:

- Membership: define plans, free/paid status, benefit eligibility, renewal and idempotent dues recording in #4.
- Ticketing: reserve capacity atomically; issue tickets against confirmed states; reject duplicate check-in in #5.
- Merchandise: use per-size stock and idempotent order/payment confirmation in #6.
- Treasury: distinguish requested, approved and paid reimbursements; trace each source transaction once in #7.
- Announcements: submission publishes immediately; composing drafts is a client concern. Publication creates notifications and a simulated outbox atomically; it does not send email or WhatsApp.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Secrets and demo credentials live in environment configuration, never in code.

## Interface language

The legacy web workspace (not the Expo client, guest ticket HTML or JSON API) is served in the language resolved from, in order: a valid `mode_lang` cookie (`en`, `hi`, `bn`, `mr`, `te`, `ta`, `gu`, `ur`, `kn`, `ml`, `pa`, `as`), the request's `Accept-Language` header, then English. The cookie is a plain preference set by the browser (`Path=/; Max-Age=1y; SameSite=Lax`), not a credential, and is never read by API routes. API error bodies keep their English `error` text; clients should localize from the stable `code` field, which is what the web workspace does.

## Local demo clock

`MODE_DEMO_NOW=<ISO timestamp>` freezes the server clock so expiry, reminders and deadlines can be demonstrated deterministically. Tests use an injected clock instead of this variable.

## Tasks, expenses and receipts (current schema v13)

All endpoints below require a session. Cookie mutations also enforce same-origin requests; valid bearer sessions retain the native authentication contract.
Identity and club scope come from the session, never from request-body member IDs.

Dashboard `Task` now includes `assigneeId: string | null` so clients can show task actions using the same assignment rule as the server. A volunteer role alone does not authorize updates to another member's or an unassigned task. `AuthMeResponse` names the existing `/api/auth/me` shape: `{ user: SessionUser, pass: MemberPass }`.

`npm run sync:contracts` generates `client/src/generated/contracts.ts` directly from `src/lib/contracts.ts`; `npm run check:client-contracts` fails when it drifts. Do not edit the generated file. Web uses relative `/api` requests with same-origin cookies and never stores the login response token. Native uses one SecureStore session token and omits cookies. Neither client implements a refresh-token protocol. A 401 clears the session; 403 retains identity and shows the permission error. Failed logout retains the current workspace with a retryable error; stale request completions cannot alter a newer session.

Version 12 preserves legacy workflow-v2 tasks and receipt metadata, and imports historical `ledger_entries` into the current ledger after the released v10 receipt and v11 announcement migrations. The two known copied seed incomes are matched by their fixed identities, amount and date, so they are not counted twice. Paid expenses match by purpose, amount, event, payment reference and date. Unknown historical payers remain null with explicit `legacy_ledger_imports` evidence; new payments still require an officer. Ambiguous or unmatched paid sources abort the entire migration rather than guess. Keep a database backup before upgrading; resolve the reported historical inconsistency before retrying.

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
| GET | `/api/ledger/export.csv` | ledger:read | canonical seven-column CSV described below |
| GET | `/api/ledger/entries/{id}/source` | ledger:read, same club | exact source record; 404 for opening balances or missing/foreign records |
| GET | `/api/events/{id}/report` | events:report | Existing ticket report plus WorkspaceEventReport fields |

Task creation takes `{title,description?,assigneeId?,eventId?,dueAt?}`. PATCH permits the same optional fields, with null to clear description, assignee, event or deadline. Status takes `{status:"todo"|"in_progress"|"done"}`. Deadlines normalize to UTC. Assignment and event references must belong to the caller's club; mine uses the actual session member.

Expense submission takes `{amountPaise,purpose,receiptId,receiptReference?,eventId?,submissionId?}`. The optional `submissionId` is a client-generated UUID retained across retries. Reusing it with the same submitter and normalized content returns the original claim (including its current status); changed content or another submitter receives 409. Clients should reuse it after a lost response. Both first submission and identical replay return 201 with the expense; replay does not create another claim. New claims require an existing, readable receipt owned by the submitter; a reference string is not an attachment. Amounts must be positive safe integer paise. Receipt ownership is checked; one member cannot submit another member's receipt. Approve takes `{}`, reject takes `{note?}`, and pay takes `{paymentReference}`. No uploader, submitter or reviewer identity fields are accepted in JSON; multipart uploader fields are ignored. Historical claims, including those with no receipt, keep their existing state and payment/retry behavior.

An expense moves submitted → approved/rejected, then approved → paid. Officers cannot review or pay their own expenses. Payment takes a database write lock before reading state, updates the expense and posts one source-linked transaction atomically. Repeating the same payment reference returns the paid expense without another outflow; a different reference conflicts. Payment records a reimbursement already made externally; it does not transfer money.

The existing `transactions` ledger remains the single source of balances, including pre-system opening balances. There is no second expense ledger. Expense sources participate in reconciliation. Task changes and expense decisions are audited.

New receipts accept JPG, PNG or PDF with checked magic bytes, at most **5 MB (5,000,000 bytes)**. Uploads use a multipart field named `file`; oversized files return 413 and unsupported signatures return 415. The request body is bounded to the file limit plus 64 KiB of multipart overhead, including chunked requests. Detected bytes determine the stored MIME type and extension, irrespective of the claimed browser type or filename. New files live at `.data/receipts/{uuid}.{ext}` by default (the receipts directory beside SQLITE_PATH), with metadata in `expense_receipts`. Downloads require the uploader or an expenses:review holder in the same club and send `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`. Failed database inserts remove their new file. Missing files return 404. Back up SQLite and this directory together.

Schema v10 renames the released receipts metadata table and records each existing UUID as its storage name. It preserves IDs, expense foreign keys, extensionless files and historical WebP downloads without moving or deleting files. New uploads use typed filenames. Released v1–v9 databases upgrade forward; reopening does not repeat the migration. Never replace released migrations with the earlier unmerged treasury branch's divergent history.

Treasury entries retain the existing `type`, category, event and reference fields and add `kind: income|expense`, `sourceType`, `sourceId`, `recordedBy` (officer ID), and `recordedByName` (current display name). Opening balances have null sourceId and officer fields in the API; the internal ledger keeps its self-link for reconciliation. The source endpoint returns `LedgerSource {type,id,title,details:[{label,value}],receiptId}` for an expense, dues payment, ticket or merchandise order. It never returns ticket QR tokens or emails; receiptId is exposed only to the receipt owner or an expenses:review holder.

The web register exports from `GET /api/ledger/export.csv`. Header: `date,kind,amount,source_type,source_id,description,recorded_by`. Amounts are positive rupees with exactly two decimals; kind supplies direction. Dates are the UTC date portion of the recorded timestamp. Officer display names appear in recorded_by; opening balances have empty source_id and recorded_by. There is no totals row: summing income and expense rows reproduces the register's integer-paise totals and balance. All textual cells beginning with `=`, `+`, `-`, `@` (including preceding whitespace), tab, CR or LF receive an apostrophe before standard CSV quote escaping. The old `/api/ledger/export` remains a compatibility endpoint with its original column layout and signed expense amounts.

Errors use 400 for invalid bodies, 401 for absent/expired sessions, 403 for role/ownership/origin failures, 404 for missing or foreign-club records, and 409 for invalid transitions. Schema v9 upgrades the released v1–v8 history without replacing existing members, sessions, passes or opening balances. Databases made by the earlier unmerged PR's conflicting schema are not a supported migration source.

The event report preserves ticket counts, attendance and realized revenue, and adds fundraiser progress and task counts. Ticket receipts, dues and merchandise income remain in the same ledger; schema v9 backfilled their club metadata and ticket event attribution. Treasury entries retain their external payment references. Reserved schema gaps remain skipped; later migrations continue above released v9.

`EXPO_PUBLIC_API_URL` configures the implemented Expo native client. Exported Expo web ignores it and uses relative API requests on the Next origin. `MODE_CORS_ORIGINS` follows the development-only policy above.

## Announcements and simulated delivery (schema v11, #8)

| Method | Path | Access | Response |
|---|---|---|---|
| GET | `/api/announcements` | public | `{announcements: Announcement[]}`, newest publication first |
| POST | `/api/announcements` | `announcements:write` (organizer/admin) | 201 `AnnouncementPublication`; 200 on an identical retry |
| GET | `/api/announcements/{id}` | public | `{announcement: Announcement}`; 404 if missing or outside the selected club |
| GET | `/api/announcements/{id}/outbox` | `outbox:manage` (organizer/admin), own club | `{delivery:"simulated",messages:AnnouncementOutboxMessage[]}` |
| GET | `/api/notifications` | signed in | `{notifications:Notification[]}`, only the session recipient's rows |

`PublishAnnouncementInput` is `{idempotencyKey,title,body}`. The server trims each string; key length is 1–120, title 3–160 and body 1–10000 characters. Unknown fields, including audience, recipient IDs, author IDs and publication timestamps, return 400. Content is plain text; clients must render it as text. Successful submission publishes immediately. Draft editing and the publishing form belong to the client work in #12.

`Announcement` is `{id,title,body,publishedAt}`; `publishedAt` is the server's UTC ISO timestamp. Public responses omit recipient addresses, member IDs, publisher IDs, idempotency keys and delivery counts. Anonymous reads select the default club; authenticated reads select the session's club. The existing dashboard also shows this dated archive within that club.

`AnnouncementPublication` is `{announcement,created,recipientCount,delivery:"simulated"}`. Clients generate and retain one key per intended publication. The same key and normalized title/body in the same club returns the original publication and count with `created:false`. Reusing the key with different content returns 409 (`announcement_key_reused`). Using a new key intentionally creates another publication. Keys remain durable across server restarts and are scoped to a club.

Publication takes a SQLite write lock and selects recipients using the shared P0 active-membership SQL predicate and one Asia/Kolkata calendar date: an expiry today is active; yesterday and null are excluded, regardless of `duesStatus` or role. It inserts the announcement, one in-app notification and one outbox row per active member, and the audit event in the same transaction. Any insert failure rolls everything back. Empty audiences are valid. Retries keep the original recipient snapshot, including after renewals or expiry; unique `(announcement_id,member_id)` indexes also prevent duplicate recipient rows.

`AnnouncementOutboxMessage` is `{id,announcementId,memberId,recipientEmail,subject,body,status:"simulated",createdAt}`. This private endpoint shows the saved recipient address at publication. **Simulated delivery only: no email or WhatsApp is sent, and there is no dispatch endpoint.** A stored row does not prove external delivery. Real dispatch is deferred in [TODOS.md](../TODOS.md).

`Notification` is `{id,kind,title,body,createdAt,readAt,announcementId}`. Announcement rows use `kind:"announcement"`; existing dues notifications have `announcementId:null`. Query parameters cannot change the recipient. All these responses use `Cache-Control: no-store`. Missing sessions return 401 on protected endpoints, insufficient roles and cross-origin cookie writes return 403, malformed input returns 400, and missing/foreign-club details return 404. Valid bearer mutations retain the existing native-client behavior.

Schema v11 follows the released receipt migration v10 (rather than filling a skipped version), keeps starter announcements as default-club archive entries without retroactive delivery, and adds nullable announcement links to existing notification/outbox rows. Legacy dues reminders remain intact. Published content has no update/delete API; publish a correction with a fresh key.

### Authentication status

The workspace uses the existing HttpOnly cookie session for browsers. Native callers can use the existing bearer token returned by login; role and club checks are identical.

Guest ticket links at `/t/{token}` retain JSON for API requests. Requests accepting `text/html` receive a private, noncached ticket page with QR, short code, fixed price, hold/payment/admission state and refresh link. No third-party QR service is used.
## WhatsApp notification preparation

Schema 14 adds a separate durable WhatsApp queue. OpenWA sending is not connected
yet; every settings/queue response includes `senderReady: false`. Existing
announcement `delivery: "simulated"` describes the unchanged email-shaped outbox,
not the new WhatsApp queue. See [OpenWA implementation and limits](OPENWA.md).

| Method | Route | Access | Body / response |
| --- | --- | --- | --- |
| GET | `/api/whatsapp/preferences` | Signed-in member, own record | `{ preferences: { phone, enabled }, senderReady: false }` |
| PUT | `/api/whatsapp/preferences` | Signed-in member, own record | `{ phone: string or null, enabled: boolean }`; returns saved preferences |
| GET | `/api/whatsapp/group` | `outbox:manage` | `{ group: { destination, enabled }, senderReady: false }` |
| PUT | `/api/whatsapp/group` | `outbox:manage` | `{ destination: string or null, enabled: boolean }`; returns saved group |
| GET | `/api/whatsapp/deliveries` | `outbox:manage` | `{ deliveries: [...], senderReady: false }`; latest 100 in the caller's club |
| POST | `/api/whatsapp/deliveries/{id}/retry` | `outbox:manage` | `{ queued: true }`, or 409 `whatsapp_retry_unavailable` |

PUT bodies reject unknown properties. Enabled preferences require a phone with a
leading `+` and 8–15 digits; enabled groups require a nonempty opaque destination
without whitespace, at most 256 characters. A missing record defaults to disabled
with a null destination. Phone numbers are excluded from public member responses.
The deliveries response exposes id, kind, audience, status, attempts, timestamps
and a fixed error code, but no message body or recipient address.

All mutations use the standard cookie same-origin checks or valid bearer-token
authorization. Only confirmed `failed` deliveries below three total attempts can
be requeued. `accepted`, `uncertain`, `sending` and cancelled entries cannot be
retried through this API. There is no HTTP send endpoint in this release.

## Payment identity and retry recovery

Dues, ticket confirmations and merchandise confirmations share a club-scoped external-payment check. A reference already used by another revenue source returns `409 payment_reference_reused` and the whole attempt rolls back. References are trimmed by the request schemas and compared exactly, including case; a transfer cannot be split across modules in this release. Different clubs have independent reference namespaces.

The check and financial write run in one transaction. SQLite uses its existing immediate write lock; PostgreSQL locks the club row before checking replay state or searching all three source tables. Same-source retries return the existing result and add no income. Historical references and ledger rows are not rewritten, including pre-existing cross-module collisions; replaying those original records remains supported. This guards application payment paths, not arbitrary direct SQL writes or external bank settlement.

Web and Expo expense forms retain the original submission ID, receipt ID and payload after an ambiguous response. The fields remain locked while the user retries the same claim; a retry does not reupload the receipt. A definite validation/authentication rejection allows corrections. A conflict triggers a claims lookup: an existing submission is recovered, while a confirmed missing submission unlocks corrections with a new identity. A failed lookup preserves the pending attempt. Pending state is held in the current page session, so after a reload or leaving the screen, refresh the claims list before starting another claim.

The main English workspace at `/app` links explicitly to the multilingual legacy view at `/legacy`. Signed-in visits to `/` route to `/app`. Event-task filters are encoded in the URL for direct links, refresh and browser navigation.
