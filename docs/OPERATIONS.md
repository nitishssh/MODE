# Runtime diagnostics

Every API using the shared `route()` wrapper returns `X-Request-Id` and emits one structured JSON completion record. The record contains a static operation label, method, status, duration and success/client-error/server-error classification. It excludes URL queries, request headers/bodies and raw exception messages. Supplied UUID correlation IDs are retained; arbitrary ID strings are replaced. Treat correlation IDs as untrusted identifiers, not authentication.

Use the response ID to find the corresponding server log. A logging sink failure must not change a committed operation's response. Error details stay out of both generic 500 responses and completion logs; diagnose locally using a reproduction rather than enabling payload logging with student data.

## Probes

- `/api/health/live`: process liveness, no database initialization.
- `/api/health/ready`: current database readiness and schema version; returns 503 if the database probe fails.
- `/api/health`: retained compatibility probe with its original success shape.

Probes are dynamic and send `Cache-Control: no-store`. Readiness queries the configured database and reports its provider (`sqlite` or `postgres`) and schema version. `DATABASE_URL` selects PostgreSQL; otherwise `SQLITE_PATH` selects SQLite. A failed database probe returns 503 without exposing connection details.

The probe does not check receipt storage, connection saturation, Redis, metrics or alert delivery. These remain pilot backlog work; the endpoints alone do not establish hosted readiness or 400-student capacity. Configure a future orchestrator to restart on liveness failure and stop sending traffic on readiness failure. The PostgreSQL runtime currently uses a synchronous worker bridge, so measure concurrency and tail latency before hosting the pilot.
