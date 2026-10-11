# Join Flows — Club Switcher, Join Codes and Leaving

After the identity split (schema v14), a student can belong to several clubs. PR 2 added the club switcher; PR 3 adds joining by code and leaving (schema v16). The API contract lives in [API.md](API.md); this note records the decisions.

## Club switcher (PR 2) ✅
- `.sidebar-profile` dropdown showing every current membership with club name, role and an active indicator.
- Selecting a club calls `POST /api/auth/switch-club {clubId}` and reloads the session.
- Shown only when the person has more than one club.

## Join code (PR 3) ✅
- `clubs.join_code` (v16): nullable, unique while set. Joining by code is **off** until a club lead turns it on.
- Club leads (`roles:manage`) read, rotate or disable it at `/api/clubs/join-code`. Rotating invalidates the previous code immediately.
- Codes are 8 Crockford base32 characters, typed leniently (case, spaces, hyphens, O/0, I/L/1).
- `POST /api/clubs/join {joinCode}` requires a signed-in person (not public): joining needs to know who is joining, and it is the same person across clubs. New members always start as plain `member`.
- 404 for unknown and disabled codes alike (no club probing); 409 when already a member.
- The session stays on its current club; the client switches when it wants to open the new one.

## Leave club (PR 3) ✅
- `POST /api/clubs/{id}/leave` — any of the person's clubs, not just the active one.
- Soft leave: `members.left_at` is stamped and the row stays, so tickets, orders, dues, claims and ledger entries keep their owner.
- A departed membership is excluded from sign-in, sessions, the club list and switcher, the roster and member lookups, door passes, announcement recipients, renewal lists and the active-member count.
- Leaving the session's own club moves it to the most recently used remaining club, or signs out (cookie cleared) when none remain. Every other session on the departed membership ends.
- The last admin cannot leave (409 `last_admin`); make someone else admin first.
- Rejoining (by code, or an officer adding the email again) reactivates the same row with the role reset to `member`.

## Not in scope
- Invite links (one-time officer-issued tokens) — post-launch.
- Join/leave UI in the workspace; the API is ready for it.

## Tests
`tests/join-leave.test.ts` covers code permissions and rotation, lenient codes, duplicate/unknown/disabled codes, every place a departed member must disappear from, session moves and revocation, sign-out after the last club, the last-admin rule, rejoining by code and by officer, and the routes (401/403/404/409, status codes, cleared cookie). `tests/pagination.test.ts` checks that a published v13 database upgrades through v16.
