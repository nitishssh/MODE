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
