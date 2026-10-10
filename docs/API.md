# MODE API contracts

The implemented starter types are authoritative in `src/lib/contracts.ts`. The backend owner is Divyank; contract/integration owner is Nitish; Azman consumes these shapes. Changes must update types, this document and related ticket acceptance tests together.

## Implemented routes

All routes run on Node.js and use dynamic responses backed by SQLite. The development starter has no identity layer; use synthetic data only. Production mutations are disabled unless explicitly enabled for a trusted demo.

| Method | Path | Success | Failure |
|---|---|---|---|
| GET | `/api/health` | 200 `{status:"ok",database:"sqlite",schemaVersion:1}` | 503 `{status:"error",error:string}` |
| GET | `/api/dashboard` | 200 `Dashboard` directly, without a wrapper | 500 `{error:string}` |
| GET | `/api/members` | 200 `{members:Member[]}` | 500 `{error:string}` |
| POST | `/api/members` | 201 `{member:Member}` | 400 invalid/malformed body; 403 blocked demo/cross-origin write; 409 duplicate email; 500 storage error |
| GET | `/api/tasks?status=&assigneeId=&eventId=&overdue=true&mine=true` | 200 `TaskDetails[]` | 500 storage error |
| POST | `/api/tasks` | 201 `TaskDetails` | 400 invalid body; 403 blocked demo/cross-origin write |
| PATCH | `/api/tasks/{id}` | 200 `TaskDetails` | 400 invalid body; 403 blocked demo/cross-origin write; 404 missing task |
| POST | `/api/tasks/{id}/status` | 200 `TaskDetails` | 400 invalid status; 403 blocked demo/cross-origin write; 404 missing task |
| POST | `/api/receipts` | 201 `Receipt` | 400 invalid upload; 413 over 2 MB; 415 unsupported or invalid file signature |
| GET | `/api/receipts/{id}` | receipt bytes or metadata | 404 missing receipt |
| POST | `/api/expenses` | 201 `Expense` | 400 invalid body; 403 blocked demo/cross-origin write |
| GET | `/api/expenses?submitterId=` | 200 `Expense[]` | 500 storage error |
| POST | `/api/expenses/{id}/approve` | 200 `Expense` | 403 blocked demo/cross-origin write; 409 invalid transition or self-review |
| POST | `/api/expenses/{id}/reject` | 200 `Expense` | 403 blocked demo/cross-origin write; 409 invalid transition or self-review |
| POST | `/api/expenses/{id}/pay` | 200 `Expense` | 403 blocked demo/cross-origin write; 409 only approved expenses can be paid |
| GET | `/api/ledger/summary` | 200 `LedgerSummary` | 500 storage error |
| GET | `/api/ledger/entries` | 200 `LedgerEntry[]` | 500 storage error |
| GET | `/api/ledger/export` | CSV download | 500 export error |
| GET | `/api/events/{id}/report` | 200 `EventReport` | 404 missing event; 500 storage error |

Create-member request:

```json
{"name":"Demo Student","email":"student@example.com"}
```

Only those two fields are accepted. Name is trimmed and must have 2–120 characters. Email is trimmed, validated, lowercased and at most 254 characters. A new member has `duesStatus:"unpaid"` and `expiresOn:null`. Creating a member does not record a payment or activate paid benefits.

Validation failures may include `details:[{field:string,message:string}]`. Consumers should always handle the top-level `error`. No database paths or stack traces are returned to the client.

The `Dashboard` object contains `club`, `metrics`, `members`, `events`, `announcements`, `products`, `tasks` and `transactions`. Money fields ending in `Paise` are integer paise. ISO timestamps are UTC; `expiresOn` is a date-only string. The starter active-member metric currently treats a paid membership as valid through its expiry date using UTC day boundaries. The membership ticket must finalize the club-timezone rule.

## Data and invariants

- SQLite schema/seed initialization is transactional and versioned with `PRAGMA user_version`.
- Member email has a case-insensitive UNIQUE constraint. API validation is also enforced at the store boundary.
- A sample event's `registered` count cannot exceed capacity. The starter has no booking operation yet.
- Ledger amounts are positive integer paise; `kind` determines income versus expense. Balance is calculated on the server.
- Products are aggregate read-only examples. The merchandise ticket introduces size variants and transactional reservations.
- The six preview tables are not a completed relational domain model. Authentication, club scoping, foreign keys between future orders/tickets/receipts, and audit events belong in the implementation tickets.
- This branch does not expose product variants, cart/order creation, payment status, fulfilment status, announcement drafts/publication, mailing-list, or delivery/outbox endpoints. The UI must not fabricate those states.

## Planned conventions

These are design constraints for future tickets, not implemented endpoints:

- Identity: define session/user/club/role shapes and 401/403 behavior in #3 before integration.
- Membership: define plans, free/paid status, benefit eligibility, renewal and idempotent dues recording in #4.
- Ticketing: reserve capacity atomically; issue tickets against confirmed states; reject duplicate check-in in #5.
- Merchandise: use per-size stock and idempotent order/payment confirmation in #6.
- Treasury: distinguish requested, approved and paid reimbursements; trace each source transaction once in #7.
- Announcements: distinguish draft, publication and notification delivery; local outbox is not actual delivery in #8.
- Volunteers: task owner, deadline and status are separate from service-hour reporting in #9.

Payment and notification adapters must expose pending, succeeded and failed states honestly. Production authorization must replace the starter guard before real/shared data use.

## Platform delivery and LAN access

MODE's web UI and API are served by the same Next.js origin. The root path already serves the web application, and `/api/*` remains handled by the Node.js route handlers. This is the supported browser deployment model; there is no separate Expo web export in this repository.

`GET /api/health` is the LAN-safe liveness check. Its successful response is `{status:"ok",database:"sqlite",schemaVersion:number}`. It does not authenticate a user and must not be treated as proof of identity or authorization.

### Authentication status

Authentication status: MODE does **not** yet implement accounts, sessions, sign-in, browser cookies, role checks, or ticket check-in. Consequently there are no HttpOnly authentication cookies to configure and no supported test account or ticket code. Do not expose real member or financial data until the identity/RBAC and ticketing work is implemented. The existing mutation guard is only a local-demo protection, not authentication.

When browser authentication is implemented, same-origin session cookies must be `HttpOnly`, use `SameSite=Lax` or a more restrictive documented policy, use `Secure` in HTTPS deployments, and protect state-changing requests against CSRF. Native clients must use their explicitly designed credential flow rather than relying on ambient browser cookies.

### CORS policy

Same-origin requests require no CORS configuration. Development cross-origin browser clients are denied unless their exact origin is listed in `MODE_CORS_ORIGINS`, a comma-separated list such as `http://192.168.1.50:8081,http://localhost:8081`. Wildcards, paths, queries, and malformed origins are ignored. Allowed origins receive explicit `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, `Content-Type`, `Authorization`, `X-Requested-With`, and methods including `PATCH`. `OPTIONS` preflights receive `204`; an unlisted Origin receives `403`. An absent Origin is not a CORS grant and follows the normal same-origin/native request path.

### Future Expo configuration

There is no Expo client in this repository today. A future Expo client must set `EXPO_PUBLIC_API_URL` to an absolute API origin reachable from the device, for example `http://192.168.1.50:3000` as a placeholder only. It must never contain secrets, paths, query strings, or hashes. The shared resolver in `src/lib/api-url.ts` rejects malformed values and defaults only to `http://127.0.0.1:3000` for simulator/local use; that loopback address does not reach a physical phone.
