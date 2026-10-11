# Local container preparation

Hosting selection remains deferred. `compose.yaml` serves MODE's landing page, login and Expo workspace with a persistent SQLite database and synthetic demo accounts. The application also has a PostgreSQL runtime selected by `DATABASE_URL`; its separate local service recipe is `docker-compose.postgres.yml`, documented in [PostgreSQL](POSTGRESQL.md). This application container recipe does not configure Redis, college enrollment or a hosted pilot.

## Run with Docker Desktop

From the implementation checkout, use PowerShell:

```powershell
$env:MODE_DEMO_PASSWORD = Read-Host 'Private password for the synthetic demo accounts' -MaskInput
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://127.0.0.1:3000/api/health/ready
```

Open `http://127.0.0.1:3000` for the landing page, then sign in to reach `/dashboard`. The seeded officer emails include `lead@example.com`, `organizer@example.com`, `treasurer@example.com` and `volunteer@example.com`; use the password supplied above. Do not put student data in this demo. Changing that environment variable after initial seeding does not rotate an existing account password.

The published port binds only to localhost. The non-root process receives SIGTERM through Docker's init process. `/data` is a named volume containing both SQLite and private receipt files. `docker compose stop` stops the app; `docker compose down` removes containers while retaining the volume. Do not add `--volumes` when preserving data.

For a persistence check, create a synthetic member and receipt, run `docker compose restart app`, then verify both through the UI. `/api/health/live` proves the process can respond; `/api/health/ready` additionally checks the current SQLite connection. First database access performs the existing migrations and demo seeding. Readiness is not a capacity or recovery test.

## Build and runtime boundaries

The image installs both committed lockfiles, verifies their product versions against `VERSION`, exports Expo, and builds Next with `MODE_EXPO_WEB=1`. Runtime uses the same flag and the documented `next start` server. The routing configuration preserves the Next landing and login pages and serves the exported Expo workspace through the authenticated application routes. The runtime includes `/app/VERSION`; after starting a container, `docker compose exec app cat /app/VERSION` identifies its prepared source version. Client public configuration is built into the export. Database credentials, demo password and receipt files must not be build inputs. `.dockerignore` excludes environment files, data, local dependencies and previous exports.

The image currently retains the root dependency tree to support the TypeScript Next configuration. Before hosting, complete CP-11's smaller standalone image, pin verified base-image digests, and test the image on the chosen platform. Hosted PostgreSQL configuration and multi-instance concurrency safeguards, CP-12 private shared receipt storage, safe production bootstrap, separate migration jobs, backups, HTTPS/proxy configuration and the pilot load test remain prerequisites for the hosted college pilot. Running `docker compose -f docker-compose.postgres.yml up` alone does not switch this SQLite application container to PostgreSQL.

## Verification status

Run `npm run check:all` for the integrated source's build and HTTP acceptance checks. The Dockerfile and Compose recipe are prepared, but an image build, container health and volume persistence have **not** been verified in this environment. Do not treat this document as a successful container deployment. The separate PostgreSQL CI job verifies database behavior against a disposable service; it does not verify either local Compose recipe.
