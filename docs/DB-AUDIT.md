# Database audit: loopholes and gaps

Audit of the whole data layer on 10 October 2026 at schema version 12: `src/lib/db/*`,
`src/lib/database.ts`, every module in `src/lib/modules/*`, the auth helpers and the routes
that reach the database. Each item says where it is, what can go wrong, and the fix. Nothing
below has been changed in code by this audit; fixes touch modules owned by several people and
need a migration (v13+), so they are listed for the team to pick up.

Severity: **High** = money, admission or data integrity can be wrong; **Medium** = abuse or
operational problem; **Low** = hygiene.

## High

1. **Cancelled or draft events still admit paid tickets.** `events.ts` `scan()` →
   `admit()` checks only the ticket status, never `event.status`. An organizer cancels an
   event (`PATCH /api/events/{id}` with `status: "cancelled"`), the paid tickets stay `paid`,
   and the door scanner reports `Admitted`. Fix: in `admit()`, return `not_valid` unless
   `event.status === "published"`; decide what cancellation does to paid tickets (refunds are
   out of scope, but the ledger row and the ticket should at least be marked).

2. **One receipt can back any number of reimbursements.** `workspace.ts` `submitExpense()`
   checks that the receipt belongs to the submitter and that the file exists, nothing else;
   there is no UNIQUE on `expenses.receipt_id`. The same receipt can be submitted, approved
   and paid repeatedly, each time posting an `expense` ledger row. Fix: partial unique index
   `expenses (receipt_id) WHERE status <> 'rejected'` plus a domain check that returns
   `receipt_already_claimed`.

3. **Payment references are not unique for tickets, orders or expenses.** Only
   `dues_payments` has `UNIQUE (club_id, reference)`. `confirmTicket`, `confirmOrder` and
   `payExpense` accept any reference, so one UPI transfer can be recorded against several
   tickets. Fix: partial unique indexes on `(club_id, payment_reference)` for `tickets`,
   `merch_orders` and `expenses` where the reference is not null, and a `ConflictError`
   `payment_reference_reused` (dues already does this).

4. **Idempotent confirmation ignores a different reference.** `confirmTicket` and
   `confirmOrder` return `created: false` when the row is already paid, even if the officer
   sent a different reference than the one recorded. The second reference is silently lost.
   Fix: compare `payment_reference`; mismatch → `ConflictError`.

5. **Seat and stock counters are denormalised and never reconciled.** `events.registered`
   and `products.stock` are maintained by hand (`registered + 1`, `MAX(0, registered - n)`,
   `syncAggregateStock`). `MAX(0, …)` hides drift instead of surfacing it, and
   `reconcileLedger()` covers money only. The three starter events carry seeded
   `registered` values with no ticket rows, so drift already exists on day one. Fix: a
   `reconcileInventory()` next to `reconcileLedger()` that compares `registered` with
   `COUNT(tickets WHERE status IN ('pending_payment','paid'))` and variant stock with
   initial stock minus live orders; replace `MAX(0, …)` with a conditional update that
   fails loudly.

6. **Six `club_id` columns have no foreign key.** `members`, `events`, `products`, `tasks`,
   `transactions` and `announcements` got `club_id TEXT NOT NULL DEFAULT 'club-sample'` via
   `ALTER TABLE ADD COLUMN`, and SQLite cannot add a `REFERENCES` clause together with a
   non-NULL default. A typo or a deleted club leaves orphans that every club-scoped query
   silently hides. Fix: a table-rebuild migration (`CREATE TABLE new … ; INSERT … ; DROP; RENAME`)
   for those six tables; the PostgreSQL translation can add the constraints directly.

7. **`postLedgerEntry` falls back to the sample club.** `ledger.ts` inserts
   `COALESCE(?, 'club-sample')` for `club_id`. A caller that forgets `clubId` posts money to
   the wrong club without an error. All current callers pass it, but the default should be a
   `ValidationError`, not a constant.

## Medium

8. **Password change does not revoke sessions.** `identity.ts` `setPassword()` writes the new
   hash and nothing else. A member whose account was compromised stays logged in on the
   attacker's device for up to 7 days. Fix: `UPDATE sessions SET revoked_at = now WHERE
   member_id = ? AND revoked_at IS NULL` in the same transaction.

9. **Members cannot change their own password.** The only route is
   `POST /api/members/{id}/password`, which requires `roles:manage`. Self-service accounts
   created by `register()` are stuck with their first password. Fix: `POST /api/auth/password`
   that verifies the current password, writes the new hash and revokes other sessions.

10. **No login throttling.** `login()` has no attempt counter, delay or lockout; scrypt costs
    about 50 ms, so a single client can try ~20 passwords per second against any email. The
    demo accounts use a published default password. Fix: per-email and per-IP counters in a
    small `login_attempts` table (or in memory for the single-process deploy) with a backoff.

11. **Guest bookings can exhaust capacity for free.** `POST /api/events/{id}/guest-tickets`
    is anonymous (same-origin check only). Each distinct email takes a seat for 30 minutes;
    a script with throw-away addresses holds every seat indefinitely by re-booking as holds
    expire. Fix: cap pending guest holds per event (for example 10 % of capacity), rate-limit
    by IP, or require the guest to confirm the email before the seat is held.

12. **Nothing is ever deleted.** There is no `DELETE` statement in the codebase. Expired and
    revoked `sessions`, expired holds in `tickets`/`merch_orders`, `membership_reminders`,
    `notifications`, `outbox_messages` and `audit_events` grow without bound, and
    `sessions` has no index on `expires_at`. Fix: a `purge()` maintenance call (sessions older
    than TTL, outbox older than N days) exposed as a script, and an index on
    `sessions (expires_at)`.

13. **Public and member reads take the write lock.** `publicTicket()`, `myTickets()`,
    `myOrders()`, `listOrders()` and `pendingHolds()` run inside `transaction()` so that
    `releaseExpiredHolds()` can write. Every hit on the anonymous `/t/{token}` page therefore
    issues `BEGIN IMMEDIATE` and serialises behind every other writer. Fix: only start a
    write transaction when a lapsed hold actually exists (`SELECT 1 … LIMIT 1` first), or move
    hold expiry to a periodic job.

14. **One officer can approve and pay the same expense.** `reviewExpense()` and
    `payExpense()` both require `expenses:review` and only exclude the submitter. Fix: in
    `payExpense()`, reject when `reviewer_id === actor.memberId` unless the club has a
    single treasurer (configurable).

15. **Member tokens are not checked against ticket tokens.** `events.ts` allocates ticket
    passes while checking both `tickets` and `members`, but `identity.ts` `insertMember()`
    checks only `members`. A member short code could collide with an existing ticket short
    code; the scanner resolves the ticket first and the member can never be found by code.
    Probability is small (50-bit codes) but non-zero and the fix is one UNION in
    `tokenExists`.

16. **Ledger helpers on the database object are global, not club-scoped.** `db.ledger.list()`
    and `db.ledger.balance()` read all clubs' rows. Routes use the club-scoped
    `getLedgerEntries()` instead, so this is not exposed over HTTP today, but any future
    route that reaches for `db.ledger.*` leaks across clubs. Fix: require `clubId` on both.

## Low

17. **`members.email` is unique across all clubs.** A person cannot belong to two clubs and
    `register()` always joins the sample club; multi-club is nominal. Documented, but the
    `clubs` table suggests otherwise.

18. **`tasks.assignee` is a name snapshot.** It is kept alongside `assignee_id` for the
    starter UI and goes stale when the member is renamed. Fix: drop the column once the
    legacy page no longer reads it.

19. **Missing indexes.** `outbox_messages (club_id, created_at)` (`simulatedOutbox` scans),
    `audit_events (club_id, occurred_at)` (`listAudit` sorts), `sessions (expires_at)`
    (purging), `expenses (receipt_id)` (double-claim check), `notifications (announcement_id)`
    is covered by the unique index.

20. **`membership_reminders` has no primary key.** Harmless in SQLite (rowid), but the
    PostgreSQL translation adds `seq` for that reason; declaring `PRIMARY KEY (member_id,
    expires_on)` is cleaner.

21. **Pending-unit cap is per variant only.** `MAX_PENDING_UNITS_PER_VARIANT = 2` lets one
    member hold 2 units of every size of every product at once. A per-member total cap is
    cheap.

22. **Dashboard shows unreleased holds.** `getDashboard()` reads `events.registered` without
    calling `releaseExpiredHolds()`, so the public "available" figure can lag until any
    ticket path runs.

23. **Timestamps and JSON are `TEXT`.** Correct for SQLite and preserved in the PostgreSQL
    translation for fidelity; `timestamptz`, `date` and `jsonb` are the natural follow-up
    after the runtime port (`docs/POSTGRESQL.md`).

24. **A failed confirmation undoes the hold release it just performed.** `confirmTicket()` and
    `confirmOrder()` call `releaseExpiredHolds()` and then throw `hold_expired` inside the same
    transaction, so the rollback restores the expired hold; the seat or unit is freed only by
    the next caller. Harmless for correctness (every path re-runs the release) but it makes
    "available" lag by one request. Fix: release in its own transaction before the conditional
    update, or return the conflict without throwing.

25. **`migrate()` special-cases `user_version = 2` without `members.club_id`.** A guard for
    a historical half-applied v2; it can be removed once no such database exists.

## What is solid

For the judges and for anyone extending the schema: `BEGIN IMMEDIATE` plus conditional
`UPDATE … WHERE` and UNIQUE backstops make seat, stock and status transitions atomic;
`transactions (source_type, source_id)` is unique so no money-moving record posts twice;
`reconcileLedger()` walks both directions; passwords are scrypt, session tokens are stored
hashed, QR tokens are 128-bit and short codes 50-bit Crockford; migrations run once inside a
write transaction and refuse a newer database; `docs/schema.sql` and
`docs/schema.postgres.sql` are generated from the migrations and checked in CI.
