# MODE HTTP API reference

Documented commit: `a62c6e27724eccfafe54f3d85c9ddf066fb7c033` on pushed `main`, 10 October 2026. See the [codebase guide](CODEBASE.md), [development examples](DEVELOPMENT.md), [shared types](CODE-REFERENCE.md#shared-api-types) and [database schema](DATA-MODEL.md).

## Common contract

Use JSON for structured requests except receipt uploads, which use multipart form data. Successful JSON responses are not all wrapped: the tasks/expenses/treasury APIs often return an object or array directly, while other modules use named envelopes. The tables below preserve that distinction. Money fields named `*Paise` contain integer paise; divide by 100 for rupees. Timestamps are ISO UTC, while membership `expiresOn` is an Asia/Kolkata calendar date.

Most handlers use `json()` and `route()`, returning `Cache-Control: no-store`. Errors normally have `{error,code?,details?:[{field,message}]}`. Some explicit upload/action errors omit `code`. Unknown failures return a generic 500 response and log details on the server. The health route returns 503 when the database is unavailable.

| Status | Meaning |
|---|---|
| 200 | Read, update or idempotent retry succeeded |
| 201 | A record or first payment/publication transition was created |
| 400 | Malformed JSON or invalid fields |
| 401 | Missing/invalid/expired/revoked selected session |
| 403 | Permission, ownership or cookie-origin check failed |
| 404 | Missing/foreign-club record or unknown action |
| 409 | Duplicate identity/reference, capacity/stock conflict or invalid transition |
| 413 / 415 | Oversized receipt / unsupported receipt signature |
| 500 / 503 | Unexpected failure / unavailable database health |

## Authentication and permissions

Login/register return `{user,expiresAt,token}` and set `mode_session`. The cookie uses HttpOnly, SameSite=Lax and Path=/; Secure is added when the request URL is HTTPS or the first `x-forwarded-proto` value is `https`. A reverse proxy must set that header correctly. Sessions last seven days. Native clients send `Authorization: Bearer <token>` instead. An Authorization header always takes precedence over a cookie, including when malformed. Invalid bearer authentication fails even on optional-auth routes.

Cookie mutations enforce same-origin checks. Login, registration and public guest booking also enforce the origin check; native clients omit browser Origin headers. An authenticated bearer request bypasses cookie-origin protection but still needs permission and same-club access. Bearer logout leaves unrelated cookies untouched; cookie logout clears the cookie.

Every signed-in role has `bookings:create`, `orders:create`, `expenses:submit`. Additional permissions:

| Role | Additional permissions |
|---|---|
| `member` | None |
| `volunteer` | `tickets:check_in` |
| `organizer` | `members:create`, `members:read`, `membership:record_payment`, `membership:reminders`, `events:write`, `events:report`, `tickets:check_in`, `payments:confirm`, `products:write`, `orders:fulfil`, `announcements:write`, `outbox:manage`, `tasks:write` |
| `treasurer` | `members:read`, `membership:record_payment`, `events:report`, `payments:confirm`, `ledger:read`, `expenses:review` |
| `admin` | Every permission, including `roles:manage` |

The UI receives `user.permissions`; visibility should use those permission strings. Ownership constraints still apply to admins where implemented, particularly self-review/self-payment of expenses and changing one's own role.

## Identity, health and overview

| Method / path | Access | Request | Success body |
|---|---|---|---|
| POST `/api/auth/register` | Public, origin guard | `{name,email,password}` | 201 `AuthResponse` + cookie |
| POST `/api/auth/login` | Public, origin guard | `{email,password}` | 200 `AuthResponse` + cookie |
| POST `/api/auth/logout` | Cookie logout may be anonymous/idempotent; bearer must validate | No body | `{ok:true}` |
| GET `/api/auth/me` | Signed in | None | `{user:SessionUser,pass:MemberPass}` |
| GET `/api/health` | Public | None | `{status:"ok",database:"sqlite",schemaVersion:11}` at this snapshot |
| GET `/api/dashboard` | Public, enriched by permissions | None | `Dashboard` |
| GET `/api/members` | `members:read` | None | `{members:Member[]}` |
| POST `/api/members` | `members:create` | `{name,email}` | 201 `{member}` |
| PATCH `/api/members/{id}/role` | `roles:manage` | `{role}` | `{member}` |
| POST `/api/members/{id}/password` | `roles:manage` | `{password}` | `{ok:true}` |

Names are trimmed, 2–120 characters. Emails are trimmed, validated, lowercased, maximum 254 characters and globally unique case-insensitively. Registration/password assignment requires 8–200 password characters; login accepts 1–200. Unknown body fields are rejected. Registration always creates a plain member in the default club. Officer-created members have no password or active membership. Duplicate email returns `409 duplicate_member`; self-role changes return `409 self_role_change`.

Anonymous dashboard calls withhold members, tasks and transactions. Callers without `members:read` receive `members:[]`; callers without `ledger:read` receive `transactions:[]` and balance zero. The `access` flags distinguish hidden data from an empty dataset. Other dashboard arrays are club-scoped but do not use the dedicated event/product publication filters.

## Membership and notification inbox

| Method / path | Access | Request | Success body |
|---|---|---|---|
| POST `/api/membership/dues` | `membership:record_payment` | `{memberId,reference}` | 201 first record / 200 retry: `{payment,created,membership,expiresOn}` |
| GET `/api/members/{id}/dues` | `members:read` | None | `{payments:DuesPayment[]}` |
| GET `/api/membership/expiring` | `members:read` | `?days=30` (default) | `{asOf,windowDays,members:ExpiringMember[]}` |
| POST `/api/membership/reminders/run` | `membership:reminders` | Optional JSON `{days}`; absent defaults to 30 | `{asOf,windowDays,candidates,sent,skipped}` |
| GET `/api/notifications` | Signed in | None | `{notifications:Notification[]}` |

Reference is trimmed, 3–120 characters. `days` is an integer from 0–365. Expiring results include today through the inclusive horizon, and exclude already expired memberships. Dues amounts are server-selected from club configuration; clients cannot choose them. A repeated reference for the same member creates no additional renewal/income; the same reference for another member returns `payment_reference_reused`.

Reminder `sent` counts locally created simulated notifications/outbox records, not external delivery. There is one reminder per member/expiry date. Notification queries always use the session recipient; query parameters cannot switch the member. No mark-read endpoint exists. See the frozen-clock `asOf` caveat in the [codebase guide](CODEBASE.md#implementation-limits-and-nuances).

## Events, tickets and door scanning

| Method / path | Access | Request | Success body |
|---|---|---|---|
| GET `/api/events` | Public; event writers also see unpublished | None | `{events:EventDetails[]}` |
| POST `/api/events` | `events:write` | Event creation fields below | 201 `{event}` |
| GET `/api/events/{id}` | Public, drafts require `events:write` | None | `{event}` |
| PATCH `/api/events/{id}` | `events:write` | Any supported event fields | `{event}` |
| POST `/api/events/{id}/tickets` | `bookings:create` | No body | 201 `{ticket}` including own QR token |
| GET `/api/events/{id}/tickets` | `payments:confirm` | None | `{tickets:Ticket[]}` |
| POST `/api/events/{id}/guest-tickets` | Public, origin guard, default club | `{name,email}` | 201 `{ticket,url}` where url is `/t/{qrToken}` |
| GET `/api/events/{id}/holds` | `payments:confirm` | None | `{holds:Ticket[]}`, soonest expiry first |
| POST `/api/tickets/{id}/confirm` | `payments:confirm` | `{reference}` | 201 first payment / 200 retry: `{ticket,created}` |
| POST `/api/tickets/{id}/cancel` | Owner or `payments:confirm` | No body | `{ticket}` |
| GET `/api/tickets/mine` | Signed in | None | `{tickets:Ticket[]}` including own QR tokens |
| GET `/t/{token}` | Possession of the random QR token | None | `{ticket:PublicTicket}`; JSON, not a rendered ticket page |
| POST `/api/events/{id}/scan` | `tickets:check_in` | `{credential}` | `ScanResult` |
| GET `/api/events/{id}/report` | `events:report` | None | Combined `EventReport & WorkspaceEventReport` |

Event creation requires `title` (trimmed 3–140), `startsAt` (ISO timestamp with offset), `venue` (trimmed 2–200), `capacity` (integer 0–100000), `memberPricePaise` and `guestPricePaise` (nonnegative integers). Optional `description` is trimmed, maximum 2000, default empty; `status` is `draft|published|cancelled`, default published. PATCH uses these fields without creation defaults. Capacity cannot drop below registered seats after applicable hold cleanup.

Guest name/email use the membership length rules. An email already belonging to a member in that club returns `409 member_email`. Payment reference is trimmed, 3–120; scan credential is trimmed, 1–200. The server stores booking-time prices. Nonzero tickets hold a seat for 30 minutes; zero-price tickets become paid immediately without a ledger row. Booking a started/unpublished/full event or creating a second live ticket conflicts.

Confirmation returns the original paid ticket on retries, even if another valid reference is supplied; it does not overwrite the original reference. Expired/cancelled tickets cannot be confirmed. A paid ticket cannot be cancelled (`refunds_out_of_scope`). Repeated pending-ticket cancellation is a no-op after cancellation.

Ticket responses omit QR tokens except holder-facing creation/own-list responses; officer lists can reveal guest email, other ticket mapping masks it. `/t/{token}` returns the narrower `PublicTicket` contract. The token is a private access link.

| Scan outcome | Meaning |
|---|---|
| `admitted` | Paid ticket checked in for the first time |
| `already_checked_in` | Previously scanned; original check-in time retained |
| `payment_pending` | Live pending ticket requires payment |
| `not_valid` | Credential is unknown, for another event, expired or cancelled |
| `member_no_ticket` | Active member pass with no live ticket for this event |
| `no_ticket_membership_expired` | Member pass has expired/no membership and no live ticket |

The report includes ticket state counts, paid-ticket count, attendance, realized ticket revenue, fundraiser summary and task counts. Seeded pre-system registrations are not tickets. Report revenue comes from posted income, not pending holds.

## Products and orders

| Method / path | Access | Request | Success body |
|---|---|---|---|
| GET `/api/products` | Public; product writers also see inactive | None | `{products:ProductDetails[]}` |
| POST `/api/products` | `products:write` | Product fields below | 201 `{product}` |
| GET `/api/products/{id}` | Public, selected club | None | `{product}`; direct lookup does not filter inactive products |
| PATCH `/api/products/{id}` | `products:write` | `{active:boolean}` | `{product}` |
| PATCH `/api/products/variants/{id}` | `products:write` | `{stock}` | `{product}` |
| POST `/api/orders` | `orders:create` | `{variantId,quantity?}` | 201 `{order}` |
| GET `/api/orders` | `payments:confirm` OR `orders:fulfil` | Optional `?status=` | `{orders:MerchOrder[]}` |
| GET `/api/orders/mine` | Signed in | None | `{orders:MerchOrder[]}` |
| POST `/api/orders/{id}/confirm` | `payments:confirm` | `{reference}` | 201 first payment / 200 retry: `{order,created}` |
| POST `/api/orders/{id}/cancel` | Owner or `payments:confirm` | No body | `{order}` |
| POST `/api/orders/{id}/fulfil` | `orders:fulfil` | No body | `{order}` |

Product fields: `name` trimmed 2–120; `description` trimmed up to 2000, default empty; `pricePaise` nonnegative integer; `memberPricePaise` nullable nonnegative integer, default null; `variants` array of 1–20 `{size,stock}` items. Size is trimmed 1–20, normalized uppercase and unique per product; stock is an integer 0–100000. Stock updates set currently available, unheld units rather than adding a delta.

Order quantity defaults to 1 and must be 1–2. A member may have at most two unpaid units per variant. Status filter accepts `pending_payment|paid|fulfilled|cancelled|expired`. Invalid status returns 400. Nonzero orders hold stock for 30 minutes; free orders start paid without income. Active-member discount is chosen and saved at order creation.

Important conflicts are `out_of_stock`, `pending_limit`, `product_inactive`, `hold_expired`, `refunds_out_of_scope` and `order_not_paid`. Confirmation of an already paid/fulfilled order returns `created:false` without replacing the original reference. Fulfilment is idempotent after fulfilment. Paid/fulfilled orders cannot be cancelled here.

## Tasks, receipts, expenses and treasury

| Method / path | Access | Request | Success body |
|---|---|---|---|
| GET `/api/tasks` | Signed in | `status`, `assigneeId`, `eventId`, `overdue=true`, `mine=true` filters | `TaskDetails[]` |
| POST `/api/tasks` | `tasks:write` | `{title,description?,assigneeId?,eventId?,dueAt?}` | 201 `TaskDetails` |
| GET `/api/tasks/{id}` | Signed in, same club | None | `TaskDetails` |
| PATCH `/api/tasks/{id}` | `tasks:write` | Optional supported task fields | `TaskDetails` |
| POST `/api/tasks/{id}/status` | Assigned member or `tasks:write` | `{status}` | `TaskDetails` |
| GET `/api/expenses` | Own claims; `expenses:review` can see club claims | Optional `submitterId` for reviewers | `Expense[]` |
| POST `/api/expenses` | `expenses:submit` | `{amountPaise,purpose,receiptId,receiptReference?,eventId?}` | 201 `Expense` |
| POST `/api/expenses/{id}/{action}` | `expenses:review` | approve `{}`, reject `{note?}`, pay `{paymentReference}` | `Expense` |
| POST `/api/receipts` | `expenses:submit` | multipart field `file` | 201 `Receipt` |
| GET `/api/receipts/{id}` | Uploader or `expenses:review`, same club | None | File attachment |
| GET `/api/ledger/summary` | `ledger:read` | None | `LedgerSummary` |
| GET `/api/ledger/entries` | `ledger:read` | None | `ExpenseLedgerEntry[]` |
| GET `/api/ledger/entries/{id}/source` | `ledger:read`, same club | None | `LedgerSource` |
| GET `/api/ledger/export.csv` | `ledger:read` | None | Canonical seven-column CSV |
| GET `/api/ledger/export` | `ledger:read` | None | Compatibility CSV |

Task title is trimmed 1–200; description up to 2000; IDs 1–100; dueAt is ISO with an offset. PATCH permits null to clear description/assignee/event/deadline. Status is `todo|in_progress|done`. `mine=true` uses the session member and supersedes an assignee filter. Overdue means a deadline before now and a status other than done. Task status query strings are passed as exact filters rather than enum-validated like order filters.

Expense amount must be a positive safe integer; purpose is trimmed 3–500. `receiptId` must be a UUID owned by the submitter with a readable file. Receipt reference is up to 200 and event ID 1–100. Reject note is trimmed up to 500; payment reference is trimmed 1–200. Identity fields cannot be supplied in JSON. Claims move submitted to approved/rejected, then approved to paid. Self-review and self-payment are forbidden. Repeating pay with the same reference returns the paid claim; a different reference conflicts. Repeated approve/reject is not idempotent.

Receipt uploads enforce 5,000,000 file bytes and an overall buffering bound of that size plus 64 KiB multipart overhead. Server detection accepts JPG, PNG or PDF signatures and supplies the stored MIME type/extension. Downloads include attachment disposition, `nosniff` and `private, no-store`. Existing legacy WebP/extensionless receipt files remain downloadable after migration; new WebP uploads are not accepted.

Ledger source lookup returns an exact dues/ticket/order/expense summary, not QR tokens or emails. Opening balances and missing/foreign sources return 404. Receipt IDs are exposed only when the caller can access the receipt. Treasury summary groups posted inflows/outflows by category and event, and separately reports approved unpaid expenses.

Canonical CSV header: `date,kind,amount,source_type,source_id,description,recorded_by`. Amount is positive rupees with exactly two decimals; text receives formula protection and CSV escaping. Dates use the UTC date portion; recorded_by is the officer display name. Opening balances have empty source/officer cells. No totals row is appended. The compatibility endpoint uses Date/Type/Description/Category/Event/Reference/Amount columns, signed expense values and its older escaping implementation.

## Announcements

| Method / path | Access | Request | Success body |
|---|---|---|---|
| GET `/api/announcements` | Public, selected club | None | `{announcements:Announcement[]}` newest first |
| POST `/api/announcements` | `announcements:write` | `{idempotencyKey,title,body}` | 201 first publish / 200 retry: `AnnouncementPublication` |
| GET `/api/announcements/{id}` | Public, selected club | None | `{announcement}` |
| GET `/api/announcements/{id}/outbox` | `outbox:manage`, same club | None | `{delivery:"simulated",messages:AnnouncementOutboxMessage[]}` |

All three input fields are trimmed: key 1–120, title 3–160, body 1–10000. Unknown fields are rejected, including audience, author or timestamp overrides. Publication is immediate; render content as plain text. Anonymous reads use the default club, authenticated reads the actor's club.

The response is `{announcement,created,recipientCount,delivery:"simulated"}`. The key is unique within a club. Same key/content returns the original publication and audience snapshot; same key/different normalized content returns `409 announcement_key_reused`. A new key intentionally creates a new publication. Every currently active member gets one notification and simulated outbox row in the same transaction. No update/delete/dispatch endpoint exists.

## Development CORS

The proxy matches `/api/:path*`, only in development. `MODE_CORS_ORIGINS` parses exact HTTP(S) origins; credentials, non-root paths, query/hash values, wildcard and null origins are ignored. Configured trailing slashes normalize to the origin.

Allowed preflights return 204 with methods GET, HEAD, POST, PATCH, DELETE, OPTIONS and allowed headers Content-Type/Authorization. Denied origins/methods/headers return 403 without allow-origin. Actual responses include allow-origin only for allowed origins and vary by Origin. No Allow-Credentials header is supplied; production ignores this configuration. Advertising a method in CORS does not mean each route implements it.

## Handler-to-source inventory

The following inventory is generated from explicit method exports in the documented snapshot. It includes `/t/{token}`; framework-generated HEAD/OPTIONS behavior and the metadata manifest are not counted as explicit application handlers.

<!-- GENERATED-ROUTE-INVENTORY -->

| Path | Explicit methods | Source |
|---|---|---|
| `/api/announcements/{id}/outbox` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/%5Bid%5D/outbox/route.ts) |
| `/api/announcements/{id}` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/%5Bid%5D/route.ts) |
| `/api/announcements` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/announcements/route.ts) |
| `/api/auth/login` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/login/route.ts) |
| `/api/auth/logout` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/logout/route.ts) |
| `/api/auth/me` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/me/route.ts) |
| `/api/auth/register` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/auth/register/route.ts) |
| `/api/dashboard` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/dashboard/route.ts) |
| `/api/events/{id}/guest-tickets` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/guest-tickets/route.ts) |
| `/api/events/{id}/holds` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/holds/route.ts) |
| `/api/events/{id}/report` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/report/route.ts) |
| `/api/events/{id}` | GET, PATCH | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/route.ts) |
| `/api/events/{id}/scan` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/scan/route.ts) |
| `/api/events/{id}/tickets` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/%5Bid%5D/tickets/route.ts) |
| `/api/events` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/events/route.ts) |
| `/api/expenses/{id}/{action}` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/expenses/%5Bid%5D/%5Baction%5D/route.ts) |
| `/api/expenses` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/expenses/route.ts) |
| `/api/health` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/health/route.ts) |
| `/api/ledger/entries/{id}/source` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/entries/%5Bid%5D/source/route.ts) |
| `/api/ledger/entries` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/entries/route.ts) |
| `/api/ledger/export.csv` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/export.csv/route.ts) |
| `/api/ledger/export` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/export/route.ts) |
| `/api/ledger/summary` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/ledger/summary/route.ts) |
| `/api/members/{id}/dues` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/dues/route.ts) |
| `/api/members/{id}/password` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/password/route.ts) |
| `/api/members/{id}/role` | PATCH | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/%5Bid%5D/role/route.ts) |
| `/api/members` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/members/route.ts) |
| `/api/membership/dues` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/dues/route.ts) |
| `/api/membership/expiring` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/expiring/route.ts) |
| `/api/membership/reminders/run` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/membership/reminders/run/route.ts) |
| `/api/notifications` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/notifications/route.ts) |
| `/api/orders/{id}/cancel` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/cancel/route.ts) |
| `/api/orders/{id}/confirm` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/confirm/route.ts) |
| `/api/orders/{id}/fulfil` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/%5Bid%5D/fulfil/route.ts) |
| `/api/orders/mine` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/mine/route.ts) |
| `/api/orders` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/orders/route.ts) |
| `/api/products/{id}` | GET, PATCH | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/%5Bid%5D/route.ts) |
| `/api/products` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/route.ts) |
| `/api/products/variants/{id}` | PATCH | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/products/variants/%5Bid%5D/route.ts) |
| `/api/receipts/{id}` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/receipts/%5Bid%5D/route.ts) |
| `/api/receipts` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/receipts/route.ts) |
| `/api/tasks/{id}` | GET, PATCH | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/%5Bid%5D/route.ts) |
| `/api/tasks/{id}/status` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/%5Bid%5D/status/route.ts) |
| `/api/tasks` | GET, POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tasks/route.ts) |
| `/api/tickets/{id}/cancel` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/%5Bid%5D/cancel/route.ts) |
| `/api/tickets/{id}/confirm` | POST | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/%5Bid%5D/confirm/route.ts) |
| `/api/tickets/mine` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/api/tickets/mine/route.ts) |
| `/t/{token}` | GET | [Handler](https://github.com/nitishssh/MODE/blob/a62c6e27724eccfafe54f3d85c9ddf066fb7c033/src/app/t/%5Btoken%5D/route.ts) |

Total: **48 route files, 59 explicit HTTP handlers**. Each is described above.
