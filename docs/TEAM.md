# Team ownership — 10 October 2026

The earlier agreed split is retained for backend and frontend. Deepak is no longer in the active team; Nitish now owns both system/integration and platform/release responsibilities.

| Owner | Responsibilities | Initial ticket sequence |
|---|---|---|
| **Nitish — @nitishssh** | Scope, architecture, contracts, integration, critical PR review, cross-component debugging; local setup, environments/secrets, Git workflow, CI, deployment, migrations/release checks, health/logs and rollback | #1 and #2 foundation; #14 deployment; #15 integration; #16 release; #17 optional handover |
| **Divyank — @DIVYANK-BHARDWAJ** | Schema/migrations, business logic, API implementation, auth/RBAC, validation and backend tests | #3 identity first; #4–#9 six module backends |
| **Azman — @Azmanshaikh** | Screens, reusable components, forms, dashboards, client state, API integration, responsiveness and loading/error/empty states | #10 role-aware shell; #11–#13 user workflows |

## Working agreement

- Nitish owns final scope/API contract decisions; publish changes in the issue and `docs/API.md` before integrating.
- Backend and frontend may proceed in parallel against agreed types. Dependency lists describe integration prerequisites, not a requirement to wait before designing UI.
- Every ticket has a primary assignee; ask for focused help when blocked rather than silently changing ownership.
- Branch from the current `main`, use `codex/<issue>-<short-name>` or a clearly named team branch, and link the PR to the issue.
- Move cards Backlog -> Ready -> In progress -> In review -> Done. Keep at most one active feature per person where practical.
- Done requires the ticket acceptance criteria, relevant tests and a working demo. A scaffold or mock payment does not complete the related feature ticket.
- Maintain synthetic demo data. Keep credentials in environment configuration and avoid shared passwords.

## Scope

The six required workflows are memberships; online event tickets/check-in; website and mailing announcements; merchandise/size stock/orders; volunteer task assignments; and club income/expenses/reimbursements. Whole-college academics, exams and tutoring are outside this MVP.

Core acceptance target: 11 October 2026, 10:00 AM IST, based on the event page's coding deadline. Nitish must recheck submission instructions and video timing at release. The GitHub milestone is a calendar-day target; it does not encode the exact hour.
