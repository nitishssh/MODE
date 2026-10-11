# OpenWA notifications integration

Status: queue, preferences, APIs and web settings implemented, 11 October 2026.
Both a WhatsApp group and individual members are supported as queued audiences.
The OpenWA HTTP adapter and live sending are not implemented or enabled.
Provider: https://github.com/rmyndharis/OpenWA

## Existing integration points

- `src/lib/modules/announcements.ts`: publication atomically creates an announcement,
  an in-app notification and a simulated email-shaped outbox row per active member.
  Publication retries preserve the original recipients.
- `src/lib/modules/dues.ts`: renewal reminders create in-app notifications and
  simulated outbox rows, deduplicated by member and membership expiry date.
- `src/lib/db/migrations.ts`: the existing outbox references members and stores
  recipient email addresses. It does not model a WhatsApp group destination.
- `src/lib/modules/identity.ts`: maintenance purges old simulated outbox rows.
  Real delivery records require a separate retention policy.

## Implemented behavior

| Trigger | WhatsApp group | Individual member |
| --- | --- | --- |
| Published club announcement | One message to the configured club group | One message per active member with WhatsApp notifications enabled |
| Membership renewal reminder | No personal dues details | One reminder to the affected member with WhatsApp notifications enabled |

Existing in-app notifications and simulated email outbox responses are preserved.
Event changes, ticket confirmations and task assignments are not wired yet.

Open `/app/settings` to save your own international-format phone number and
notification preference. Officers with `outbox:manage` can save a club group
destination and inspect the latest 100 delivery statuses. The group identifier is
stored as an opaque value; provider-specific validation awaits OpenWA documentation.
Settings start disabled. Changing a destination or disabling notifications cancels
pending messages for the old destination; a send already in progress may still arrive.

Schema 14 adds `whatsapp_preferences`, `whatsapp_groups` and `whatsapp_deliveries`.
The queue is written in the publication/reminder transaction. Unique indexes enforce
one group entry per source event and one entry per member per source event. No
historical publications are backfilled. Destinations are snapshotted when queuing;
the worker rechecks the current preference and destination before claiming a send.

`src/lib/whatsapp-worker.ts` exports `runWhatsAppBatch(queue, clubId, transport?, limit)`.
Without a transport it returns `{ enabled: false, processed: 0 }` and does not claim
messages. A supplied transport is an internal server interface, not an HTTP request
parameter. There is currently no HTTP send endpoint, scheduled worker or production
transport. All settings responses report `senderReady: false`.

The worker submits sequentially outside database transactions, at most 50 messages
per call (default 10), with a 30-second submission timeout. Atomic claims prevent
overlapping workers from submitting the same queued entry. Unfinished claims older
than two minutes become `uncertain` on the next worker claim attempt. Provider errors
are reduced to fixed codes so tokens and phone numbers do not leak through errors.

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for a connected worker |
| `sending` | Claimed by one worker |
| `accepted` | Provider accepted the message and returned an ID; delivery/read status is unknown |
| `failed` | Transport positively confirmed the provider rejected the message |
| `uncertain` | Submission outcome is unknown; no automatic or UI retry |
| `cancelled` | Recipient preferences or group destination changed before sending |

Only confirmed failures may be retried by an authorized officer, up to three total
attempts. Provider rate limiting and reconciliation of uncertain submissions must
be implemented with the real adapter. Delivery records are not purged automatically.

Phone numbers are available only through the member's own preferences API. Officer
queue inspection excludes phone numbers, group identifiers and message bodies.
All APIs require authentication; mutations enforce the existing same-origin or
valid bearer-token rules. Group settings and retries require `outbox:manage` and
are club-scoped. The Expo client can use these APIs, but native settings UI has not
been added. The web settings and privacy notice explain the current sending status.

## Remaining OpenWA connection

The public README fetch could not execute because automatic approval review failed
with a deployment-not-found error. No OpenWA API contract has been verified.
Obtain its documented authentication, session setup, text-send operation, direct
and group addressing, response/error format, rate limits, idempotency behavior and
delivery receipt support. Pin the integration to the verified upstream version.

Deployment then needs an OpenWA service URL, its authentication configured locally,
a connected WhatsApp session and a selected group. Do not put credentials in this
document or commit them.

After verifying the repository, implement `WhatsAppTransport`, provider rate limits,
session readiness checks and a server-side worker entry point. Keep credentials out
of browser configuration. Review queued messages before enabling delivery, since
they may have accumulated while the sender was disconnected. Live verification
needs an explicitly selected test recipient and test group.

## Validation

`tests/whatsapp.test.ts` covers disabled defaults, fan-out, private renewal reminders,
idempotency, preference changes, overlapping workers, uncertain submissions, claim
expiry, bounded retries, transaction rollback, authentication and club isolation,
plus upgrading a SQLite v13 fixture and reopening queued records. Tests use mock
transports and never send WhatsApp messages. Both schema exports are regenerated;
PostgreSQL runtime and real-provider delivery still need live verification.

The standard test command is `npm test`. In this Windows sandbox, tsx fails during
`os.userInfo()` before tests load; the local verification used TypeScript's in-process
CommonJS transpiler in `tmp/whatsapp-typescript.cjs`. Type checking is separate with
`npm run typecheck`.
