# Foundation acceptance (#1)

Issue [#1](https://github.com/nitishssh/MODE/issues/1) establishes the runnable starter. Authentication was added later in #3, so member creation now requires an organizer or administrator session.

## Verify a fresh checkout

Use Node 24 (`node --version` must report `v24.x`; `.nvmrc` records the major version). From a fresh clone:

```sh
npm ci
npm run check
npm run test:foundation
```

`check` runs TypeScript, API documentation contracts, domain/API tests and the production build. `test:foundation` starts that build on an available loopback port with a new temporary SQLite database and a randomly generated demo password. It verifies the page and seeded dashboard, signs in as an organizer, creates a member, rejects duplicate/invalid/malformed submissions without adding rows, then stops and restarts the server to verify both the member and session persist. It stops its server and removes its temporary database on completion. It never uses your configured `SQLITE_PATH` or demo password.

Run `npm run build` again after code changes before repeating the foundation check. The command requires a built app; it does not rebuild automatically. GitHub Actions runs the same check after every production build on Node 24.

## Short browser demo

1. Run `npm run dev` and open `http://127.0.0.1:3000`.
2. Sign in as `organizer@example.com` with `MODE_DEMO_PASSWORD` (development default: `mode-demo-2026`).
3. Open Members and create a fictional member with a unique email. Submit that email again and confirm the duplicate error. Invalid inputs must not add a member.
4. Stop and restart `npm run dev`, sign in if needed, and confirm the member remains.
5. Check the dashboard and member form at desktop width and a narrow mobile viewport; open the mobile navigation drawer and switch sections.

The automated HTTP check verifies server behavior, not responsive rendering. The browser steps cover that separately. Use synthetic data only; the browser demo writes to your normal local database unless you set `SQLITE_PATH` to a separate file.

## Acceptance evidence

| Issue criterion | Reproducible evidence |
| --- | --- |
| Fresh install on Node 24 | `.nvmrc`, `npm ci`, CI `setup-node` |
| Development dashboard backed by SQLite | Browser demo; health and dashboard assertions in `test:foundation` |
| Member persistence and rejected submissions | `test:foundation` through HTTP across two server processes; existing domain/API tests |
| Typecheck, tests and production build | `npm run check` and GitHub Actions |
| CI, environment example and setup docs committed | `.github/workflows/ci.yml`, `.env.example`, README and this guide |

Foundation acceptance completed on 10 October 2026 in [PR #26](https://github.com/nitishssh/MODE/pull/26), merged as [`c9c157b`](https://github.com/nitishssh/MODE/commit/c9c157bc78d21fb55b921f1f18a665a67ed0efe8). [Merged-main quality checks](https://github.com/nitishssh/MODE/actions/runs/38048522264) passed, including the new restart check.

Verified for that release:

- Windows, Node v24.21.0: `npm ci` passed in a fresh worktree; `npm run check` passed typecheck, contracts for 8 route families, all 60 domain/API tests and the production build.
- `npm run test:foundation` passed member/session persistence across a real server restart and duplicate, invalid and malformed submission rejection without extra rows.
- The development server passed organizer sign-in, member creation and duplicate rejection with an isolated synthetic dataset. Desktop (1280×900) and mobile (375×812) dashboard layout and navigation were checked in a browser.

These results describe the foundation release, not later commits or full MVP completion. Physical-device installation and hosted deployment remain separate checks.
