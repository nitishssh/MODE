# Contributing to MODE

Pick an assigned ticket from https://github.com/users/nitishssh/projects/14. The board is the implementation tracker; the repository issue contains acceptance criteria and dependencies.

```sh
git switch main
git pull --ff-only
git switch -c codex/3-auth-roles
npm ci
npm run dev
```

Use a branch name appropriate to your issue. Coordinate API changes in `docs/API.md`, keep changes focused, and include meaningful tests for business rules and failure cases.

Before opening a PR:

```sh
npm run check
npm run test:foundation
```

Use Node 24. `check` includes typecheck, API documentation contracts, domain/API tests and the production build. Run it before `test:foundation`, which starts the built server with an isolated temporary database and verifies restart persistence. See [foundation acceptance](docs/FOUNDATION.md) for the browser checks and recorded results.

Use `Closes #<issue>` only when the PR completes that issue. Move the board item to In review and describe the user-visible change, verification and remaining limitations. Nitish coordinates integration and release; every contributor should review and explain their own code.

Never commit `.env.local`, credentials, `.data/`, real member data, receipts or generated build output. The starter database is local synthetic demo data. Additional modules should use transactional updates and the authorization model from ticket #3.
