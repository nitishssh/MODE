# Database audit: findings and their fixes

Audit of the whole data layer on 10 October 2026 at schema version 12: `src/lib/db/*`,
`src/lib/database.ts`, every module in `src/lib/modules/*`, the auth helpers and the routes
that reach the database. The fixes landed the same day as **schema version 13** (`hardenSchema`
in `src/lib/db/migrations.ts`), verified by `tests/db-hardening.test.ts` on SQLite and
PostgreSQL. Each item below records the finding, the fix, and where the test is.

Severity: **High** = money, admission or data integrity can be wrong; **Medium** = abuse or
operational problem; **Low** = hygiene. Status: **Fixed**, **Accepted** (deliberate, documented),
**Policy** (fixed behind a club setting).

## High

1. **Cancelled or draft events still admitted paid tickets.** `scan()` checked only the ticket.
   **Fixed:** the door returns `not_valid` unless the event is `published`; cancelling an event
   also cancels its unpaid holds and returns the seats (audited as `releasedHolds`). Paid tickets
   stay on record because refunds are outside the MVP. Test #1.

2. **One receipt could back any number of reimbursements.** **Fixed:** a partial unique index
   `expenses_receipt_live_idx (receipt_id) WHERE status <> 'rejected'` plus a domain check that
   returns `409 receipt_already_claimed`; a rejected claim frees its receipt. Test #2.

3. **Payment references were not unique for tickets, orders or expenses.** **Fixed:** partial
   unique indexes on `(club_id, payment_reference)` for `tickets`, `merch_orders` and `expenses`,
   and `409 payment_reference_reused` before the update. Dues already had this. Test #3.

4. **A replayed confirmation silently ignored a different reference.** **Fixed:** replaying with
   the recorded reference is still idempotent (`created: false`); a different reference returns
   `409 payment_reference_mismatch`. Test #3.

5. **Seat and stock counters were never reconciled.** **Fixed:** `reconcileInventory()` next to
   `reconcileLedger()` compares `events.registered` with live tickets and `products.stock` with
   the sum of sizes. The starter's pre-ticket registrations (24 and 38) are recorded in the new
   `events.seeded_registrations` column so they are accounted for, not reported as drift.
   `npm run db:purge` prints both reports. Test #5.

6. **Six `club_id` columns had no foreign key.** **Fixed:** v13 rebuilds `members`, `events`,
   `products`, `tasks`, `transactions` and `announcements` in place on SQLite (foreign keys off
   outside the transaction, `PRAGMA foreign_key_check` afterwards; rows and rowids preserved) and
   adds `… _club_id_fkey` constraints on PostgreSQL. Orphans abort the migration before any
   change. Test #6.

7. **`postLedgerEntry` fell back to the sample club.** **Fixed:** `clubId` is required and
   validated; `db.ledger.list/balance` take a club too. Test #6.

## Medium

8. **Password reset did not revoke sessions.** **Fixed:** `setPassword()` revokes every session
   of the member. Test #8.

9. **Members could not change their own password.** **Fixed:** `POST /api/auth/password`
   `{currentPassword, newPassword}` → `changePassword()`: proves the current password, keeps the
   calling session, revokes the others, audits `member.password_changed`. Test #8.

10. **No login throttling.** **Fixed:** `login_attempts` table; five consecutive failures per
    email (unknown emails included, so nothing is revealed) lock sign-in for 15 minutes with
    `429 too_many_attempts`; a success clears the counter. Per-IP limiting remains a reverse-proxy
    job. Test #10.

11. **Guest bookings could exhaust capacity for free.** **Fixed:** at most `max(3, ⌈capacity/10⌉)`
    unpaid guest holds per event (`409 guest_holds_full`); members are unaffected. Test #11.

12. **Nothing was ever deleted.** **Fixed:** `db.purge()` / `npm run db:purge` removes expired and
    revoked sessions, stale login counters and simulated outbox rows older than 90 days; new
    index `sessions (expires_at)`. Test #12.

13. **Public and member reads took the write lock.** **Fixed:** reads call `releaseIfLapsed()`,
    which checks for a lapsed hold first and opens a write transaction only when there is one;
    `/t/{token}`, "my tickets", "my orders", order lists and the dashboard no longer start
    `BEGIN IMMEDIATE` on every hit. Test #5 covers the release path.

14. **One officer could approve and pay the same expense.** **Policy:** `clubs.require_separate_payer`
    (default off, because a one-treasurer club cannot satisfy it); `setRequireSeparatePayer()` is
    admin-only and audited; when on, the approving officer gets `403` on payment. Test #14.

15. **Member passes were not checked against ticket passes.** **Fixed:** member token allocation
    checks both tables. Test #15.

16. **Ledger helpers on the database object were global.** **Fixed:** `listLedger` and
    `ledgerBalance` require a `clubId` and filter by it. Test #6.

## Low

17. **`members.email` is unique across all clubs.** **Accepted:** single-club product; the
    `clubs` table exists for scoping, not for multi-membership.

18. **`tasks.assignee` is a name snapshot.** **Accepted:** kept for the legacy page; `assignee_id`
    is the source of truth.

19. **Missing indexes.** **Fixed:** `sessions (expires_at)`, `outbox_messages (club_id, created_at)`,
    `audit_events (club_id, occurred_at)`, plus the unique indexes above.

20. **`membership_reminders` had no primary key.** **Fixed:** `PRIMARY KEY (member_id, expires_on)`.

21. **Pending-unit cap was per variant only.** **Fixed:** six unpaid units per member in total
    (`MAX_PENDING_UNITS_PER_MEMBER`). Test #11.

22. **Dashboard showed unreleased holds.** **Fixed:** the dashboard releases lapsed holds (cheap
    check first) before reading counters.

23. **Timestamps and JSON are `TEXT`.** **Accepted:** identical semantics on SQLite and PostgreSQL;
    `timestamptz`/`jsonb` are a later, separate change.

24. **A failed confirmation undid the hold release it had just performed.** **Fixed:**
    `confirmTicket()` and `confirmOrder()` release lapsed holds in their own transaction before
    the conditional update.

25. **`migrate()` special-cases `user_version = 2` without `members.club_id`.** **Accepted:** a
    guard for a historical half-applied v2; harmless.

## What is solid

`BEGIN IMMEDIATE` plus conditional `UPDATE … WHERE` and UNIQUE backstops make seat, stock and
status transitions atomic; `transactions (source_type, source_id)` is unique so no money-moving
record posts twice; `reconcileLedger()` and `reconcileInventory()` walk both directions; passwords
are scrypt, session tokens are stored hashed, QR tokens are 128-bit and short codes 50-bit
Crockford; migrations run once inside a write transaction and refuse a newer database;
`docs/schema.sql` and `docs/schema.postgres.sql` are generated from the migrations and checked in
CI; the same suite passes on SQLite and PostgreSQL.
