# Exception handling and recovery

Date: 11 October 2026. This document describes the implemented local safeguards and the remaining hosted-infrastructure work.

## Guarantees now implemented

### API server

- Every wrapped API response receives a server-generated `X-Request-Id` UUID.
- Error JSON contains the same `requestId`, a stable `code` and a safe user-facing message.
- Expected domain failures retain their intended 4xx/429/503 status and response headers.
- Unexpected exceptions become `500 internal_error`; stack traces and internal messages never enter the response.
- Unexpected exceptions produce one structured server log containing the context, request ID, error name, internal message and stack.
- All error responses are `Cache-Control: no-store`.
- Admission counters are released in `finally`, including thrown errors and rejected promises.
- Rate-limit and capacity errors include retry metadata. Account lockout includes an HTTP-date `Retry-After`.

### Web and Expo clients

- Requests time out after 15 seconds.
- GET requests retry network failure, timeout, 429 and 503 at most twice with capped exponential backoff and jitter.
- POST/PATCH/DELETE requests are never automatically replayed. A lost mutation response is reported as `unknown_outcome`, prompting the user to refresh before retrying.
- Invalid JSON on a successful API response is rejected as `invalid_response` instead of being treated as valid data.
- `ApiError` retains status, stable code, retry delay and server request ID; the web client also retains field details.
- Overlapping identical GET requests still share one in-flight promise, including its bounded retries.

### Rendering

- `app/error.tsx` handles page/segment rendering failures and offers a safe retry plus workspace navigation.
- `app/global-error.tsx` handles root-layout failure with a self-contained document and retry action.
- Production-rendered server exceptions display only the Next.js digest/reference, not their internal message.

## Error classes

| Failure | Code/status | Automatic behavior |
|---|---|---|
| Invalid input | `validation_failed` / 400 | Show field or form guidance; no retry. |
| Missing/expired identity | `unauthenticated` / 401 | Clear session through the existing session controller. |
| Permission denied | `forbidden` / 403 | Preserve identity; explain the permission boundary. |
| Business conflict | route code / 409 | Refresh authoritative state; replay only under an explicit idempotency contract. |
| Policy limit | `rate_limited` / 429 | GET waits for retry metadata; mutation stays with the user. |
| Server capacity | `server_busy` / 503 | GET performs bounded retry; mutation is not replayed. |
| Network/timeout on GET | `network_error` or `request_timeout` / client status 0 | Two bounded retries, then visible failure. |
| Network/timeout on mutation | `unknown_outcome` / client status 0 | No replay; refresh and reconcile first. |
| Invalid successful response | `invalid_response` / client status 502 | Treat as failure; retain request reference when present. |
| Unexpected server exception | `internal_error` / 500 | Safe message and request reference; structured internal log. |
| React render exception | Next error boundary | Retry the affected segment or root document. |

## Manual verification

1. Sign in, open Developer Tools → Network, and inspect any API response. Confirm `X-Request-Id` is present.
2. Trigger a validation error, such as an invalid two-character search request. Confirm JSON contains `code`, `error` and `requestId`, with the same ID in the response header.
3. Request the summary six times immediately. Confirm the sixth returns 429, `Retry-After`, rate-limit headers, `Cache-Control: no-store` and a request ID.
4. In browser DevTools, select **Offline**, navigate to a page that loads data and confirm a clear connection message appears after bounded retries.
5. Never test uncertain payment behavior with real money or real club records. On synthetic data, interrupt a mutation request and confirm the UI does not automatically repeat it.
6. In React DevTools, trigger the route error boundary and confirm **Try again** retries the segment. Trigger the global boundary separately and confirm its standalone document renders.

## Remaining infrastructure work

Application-level exception handling cannot guarantee recovery from process termination or external-service loss by itself. Full hosted readiness still requires:

- bounded SQLite/async PostgreSQL command queues and transaction deadlines;
- asynchronous password hashing behind its semaphore;
- bounded upload streaming and cleanup telemetry;
- durable SQL jobs/outbox with lease recovery and dead-letter inspection;
- Redis limiter/cache circuit breakers and multi-instance atomicity;
- central log/metric export and alerts keyed by request ID;
- graceful shutdown/drain and forced-crash recovery tests;
- mixed-load, Redis-outage, database-slowdown and worker-replay acceptance runs.

The rate-limit and queue design for these items is in [`performance/RATE-LIMIT-QUEUE-PLAN.md`](performance/RATE-LIMIT-QUEUE-PLAN.md).
