# How to run, test and extend MODE

Applies to pushed `main` commit `a62c6e27724eccfafe54f3d85c9ddf066fb7c033` (10 October 2026). Start at the [codebase guide](CODEBASE.md); use the [API reference](HTTP-API.md), [database reference](DATA-MODEL.md) and [file map](CODE-REFERENCE.md) alongside these instructions.

## Tutorial: first working workspace

### 1. Get the documented code

Use Node 24 LTS and npm. The package accepts Node 22.13+ within 22.x or Node 24+, excluding 23.x. Run the following from a parent directory where `MODE-docs-demo` does not already exist. This creates a separate checkout without replacing your current work.

```powershell
git clone https://github.com/nitishssh/MODE.git MODE-docs-demo
Set-Location MODE-docs-demo
git switch --detach a62c6e27724eccfafe54f3d85c9ddf066fb7c033
node --version
npm ci
```

The detached checkout is for reproducing this documented version. Create a descriptive branch before making changes you intend to push.

### 2. Start and sign in

```powershell
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). On a fresh development database, sign in as `organizer@example.com` with the synthetic development password `mode-demo-2026`, unless you configured a different seed password. You should see the workspace and sample club records. The first database request creates `.data/mode.sqlite` and migrates it to schema 11.

Seeded accounts include `lead@example.com` (admin), `organizer@example.com`, `treasurer@example.com`, `volunteer@example.com`, `active@example.com` and `expired@example.com` (members). They use the configured demo password at the time they are seeded. The original Asha, Rohan and Meera records have no password until an admin assigns one. Changing `MODE_DEMO_PASSWORD` later does not update existing account hashes.

### 3. Make a persistent change

As organizer, open Members and add a synthetic name/email, or open Tasks and create a task. Confirm the record appears, refresh the page and check it again. Stop the development server with Ctrl+C, restart `npm run dev` and confirm the record remains.

The new member starts unpaid, without an expiry or password. Adding a member does not collect dues or grant login credentials.

### What you built

You now have the actual web app, role-based browser authentication, SQLite persistence and a working mutation. The [architecture guide](CODEBASE.md) traces the same operation from the form through its route and domain module to SQLite.

## Configuration reference

Copy `.env.example` to `.env.local` only when you need overrides and that file does not already contain your settings. Next.js reads `.env.local`; standalone scripts/tests may require environment variables set directly in the shell. Restart the server after changing configuration.

| Variable | Default / behavior |
|---|---|
| `SQLITE_PATH` | `.data/mode.sqlite`, resolved from the process directory. The adjacent `receipts` directory stores attachments. A new path creates a separate dataset. |
| `MODE_DEMO_PASSWORD` | Synthetic seed password. Development fallback is `mode-demo-2026`; production seeding requires a nonempty configured value. Choose a private value before a shared demo. Existing hashes do not rotate when this changes. |
| `MODE_DEMO_NOW` | Optional parseable timestamp for the application clock. Invalid values fall back to the real clock. Useful for expiry/deadline demonstrations. |
| `MODE_CORS_ORIGINS` | Optional comma-separated exact HTTP(S) browser origins, applied only in development. No wildcard or credentialed cross-origin cookie support. |
| `EXPO_PUBLIC_API_URL` | Reserved for a future Expo client. `resolveExpoApiUrl()` defaults to `http://127.0.0.1:3000`; browser MODE uses relative URLs instead. This is public configuration. |
| `NODE_ENV` | Set by the runtime/tooling; production disables the development CORS proxy and the missing-password seed fallback. |

For example, choose a separate synthetic dataset and deterministic clock in PowerShell:

```powershell
$env:SQLITE_PATH = '.data/docs-demo/mode.sqlite'
$env:MODE_DEMO_NOW = '2026-10-10T08:00:00.000Z'
npm run dev
```

That path stores receipts in `.data/docs-demo/receipts`. Use a different dataset directory when you need independent database and receipt storage.

## How to exercise the API

Keep the development server running. In another PowerShell window, log in with the synthetic development credentials or substitute the seed password you configured:

```powershell
$base = 'http://127.0.0.1:3000'
$loginBody = @{ email = 'organizer@example.com'; password = 'mode-demo-2026' } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' -Body $loginBody
$authHeaders = @{ Authorization = "Bearer $($session.token)" }
Invoke-RestMethod -Uri "$base/api/auth/me" -Headers $authHeaders
Invoke-RestMethod -Uri "$base/api/members" -Headers $authHeaders
```

These native requests do not send browser Origin headers. Keep the returned token private. `me` returns `{user,pass}`; the directory returns `{members}`. Browser code should continue using the HttpOnly cookie instead of storing a token in browser storage.

### Publish a synthetic announcement and verify retry behavior

This example intentionally writes one publication to the local demo database. It creates a unique key for this run, then reuses the exact payload for the retry.

```powershell
$publicationBody = @{
  idempotencyKey = "docs-demo-$([guid]::NewGuid())"
  title = 'Synthetic club update'
  body = 'A local documentation walkthrough announcement.'
} | ConvertTo-Json
$publication = Invoke-RestMethod -Method Post -Uri "$base/api/announcements" -Headers $authHeaders -ContentType 'application/json' -Body $publicationBody
$retry = Invoke-RestMethod -Method Post -Uri "$base/api/announcements" -Headers $authHeaders -ContentType 'application/json' -Body $publicationBody
$retry.created
Invoke-RestMethod -Uri "$base/api/announcements/$($publication.announcement.id)/outbox" -Headers $authHeaders
```

The retry's `created` value should be false and its announcement ID should match. Outbox `delivery` and message status are `simulated`. Recipient count depends on the current dataset and membership dates; do not assume a fixed count for an existing database.

End the session when finished:

```powershell
Invoke-RestMethod -Method Post -Uri "$base/api/auth/logout" -Headers $authHeaders
```

## How to demonstrate reimbursement and ledger behavior

1. Sign in as a member or volunteer. Open My Expenses and upload a real JPG, PNG or PDF of at most 5,000,000 bytes. Submit a synthetic expense with a purpose and amount.
2. Sign out and sign in as `treasurer@example.com` or another finance reviewer. Open Treasury and inspect the submitted claim and receipt. The submitter cannot approve or pay their own claim, even if they are an admin.
3. Approve the claim. Confirm it appears as approved but unpaid; approval should not reduce the ledger balance.
4. Record an external payment reference using the payment action. Confirm one expense row appears in the register, with the paying officer and a source link.
5. Open the source and export CSV. The canonical export has `date,kind,amount,source_type,source_id,description,recorded_by`; amounts are positive rupees with two decimals, and `kind` supplies direction.

If upload succeeds but submission fails, read the inline error. A reference string alone is not an uploaded receipt. Repeating payment with the same reference is safe; changing the reference of a paid claim conflicts. This walkthrough records fictional payments only.

## How to run quality checks

| Command | Checks / behavior |
|---|---|
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run check:contracts` | Required route-family strings and delivery documentation in `docs/API.md`; not exhaustive schema validation |
| `npm test` | `tsx --test tests/*.test.ts`; domain, handler and regression tests |
| `npm run build` | Next.js production compilation |
| `npm run check` | Typecheck, contract-doc check, tests, then build |
| `npm run test:foundation` | Starts the built app with isolated storage, exercises HTTP and restarts the server to check persisted members, sessions and announcement retries |

Run in this order for the documented verification workflow:

```powershell
npm run check
npm run test:foundation
```

The foundation script requires the build first. It creates a temporary database and random seed password; it does not use your working demo database. The [test inventory](CODE-REFERENCE.md) explains what each suite covers.

GitHub Actions uses Ubuntu and Node 24, runs install/typecheck/contracts/tests/build/foundation and has a 15-minute job timeout. At this commit it runs on every pull request, and pushes to `main` plus the legacy `codex/**` pattern. A differently named branch does not get push-triggered checks until a PR exists. Use descriptive branch/PR names without agent/provider names, as requested in the project instructions. There is no deployment step in this workflow.

## How to run a LAN or production-mode demo

Before a private LAN demo, stop any running server and choose a new dataset directory that has never been seeded. Set a private seed password before the first database request. Do not reuse the default tutorial database: changing the environment variable does not rotate its existing account passwords.

```powershell
$env:SQLITE_PATH = '.data/private-lan-demo/mode.sqlite'
$env:MODE_DEMO_PASSWORD = Read-Host 'Enter a private demo seed password (not the public development default)'
npm run dev:lan
```

Open `http://<computer-LAN-IP>:3000` on the same network and permit the server through the private-network firewall when needed. That address is a placeholder for the server's actual IP. Sign in on the same origin you use for the workspace. A phone's loopback address refers to the phone, not your computer. Browser MODE on the same host does not require CORS configuration.

Use synthetic data on a private network only. Plain HTTP sends login credentials and session cookies without transport encryption. Use HTTPS for hosted access.

For production mode, use the same fresh-dataset and private-password preparation above before first seed, then:

```powershell
npm run build
npm start
```

`npm start` binds to `127.0.0.1`. Use `npm run start:lan` when you intentionally need all network interfaces. Hosted use needs HTTPS and persistent storage. The manifest supports a browser's install/home-screen flow when the browser and secure context allow it; there is no offline service worker.

## How to preserve or move data

Stop the app before making a simple filesystem backup. Copy the configured SQLite database, any adjacent SQLite `-wal`/`-shm` files that remain, and its complete adjacent `receipts` directory together into a new backup directory. Restore the matching set together and point `SQLITE_PATH` to the restored database. For live backups, use SQLite-aware backup tooling instead of copying an actively written database file.

Schema migrations run automatically on open. Keep released migrations unchanged and append a new version above 11; historical versions 5 and 7 remain skipped. Newer-schema databases are rejected by older application code. Use a matching application version or a separate dataset rather than deleting the real database to resolve that error.

## How to extend a module

1. Read the relevant guide under `node_modules/next/dist/docs/` before changing Next.js code. This repository uses Next.js 16 route handlers and `proxy.ts`; route parameters are promises handled by `route()`.
2. Update shared contracts in `src/lib/contracts.ts`, then validate input at the HTTP boundary. Domain methods that are directly callable may also need their own validation; do not assume every existing helper validates all fields.
3. Implement behavior in the appropriate domain module, using the session actor for ownership and club scope. Keep the route thin.
4. For money changes, update the source and post its ledger row inside one synchronous transaction. Register source existence checks and extend reconciliation's source enumeration. Define retry and zero-price behavior explicitly.
5. Add focused tests for permissions, foreign-club access, retries, invalid transitions and relevant concurrency/expiry cases. Use `memoryDatabase`, `actorFor`, `withRouteDatabase` and `routeParams` from the test helpers.
6. Update the API docs and the corresponding UI. Distinguish backend availability from finished screens. Run the checks above and submit a descriptive feature branch/PR.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `node:sqlite` unavailable | Switch to Node 24 LTS, reinstall dependencies with `npm ci` and restart. |
| New production database fails health check | Configure `MODE_DEMO_PASSWORD` before initialization and check storage permissions. |
| Seed password appears ignored | The database already contains account hashes. Use the existing password/admin assignment or a new separate synthetic dataset. |
| API returns 401 | Session missing, expired or revoked; an Authorization header selects bearer auth even if a valid cookie exists. Log in again. |
| API returns 403 | Check permission, ownership, same-club scope and the browser origin. CORS does not grant login or cookie mutation exceptions. |
| Receipt returns 413/415 | Use a supported actual file signature and stay within the decimal 5 MB limit. Renaming an unsupported file is insufficient. |
| Receipt metadata exists but download is 404 | Restore its corresponding stored file or upload again. Preserve the receipt directory with the database. |
| `hold_expired`, `out_of_stock` or `sold_out` | Refresh and create a new reservation if capacity/stock permits. Expired holds cannot be revived. |
| Foundation check says build first | Run `npm run build` before `npm run test:foundation`. |
| New docs describe files missing in your checkout | Compare your commit to the pinned snapshot. Follow the separate clone tutorial to inspect the documented code. |
