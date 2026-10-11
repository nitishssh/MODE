# PR 2: Join Flows — Club Codes, Invites and Switcher

After PR 1 (identity split), a student can belong to multiple clubs. PR 2 makes it easy to switch between them.

## Features Implemented

### 4. Club switcher (web shell) ✅
- `.sidebar-profile` dropdown showing all memberships
- Each item shows: club name, role badge, active indicator (✓)
- Click to `POST /api/auth/switch-club {clubId}` and reload session
- Only shows if user has more than one club
- Styled with light/dark theme support
- Integrated into [shell.tsx](../src/app/app/_components/shell.tsx)

## Features Deferred to PR 3 (v15 migration)

### 1. Club join code (rotatable)
- Add `clubs.join_code` TEXT UNIQUE (nullable, rotatable) — v15 migration
- API: `POST /api/clubs/join {joinCode}` — current user adds themselves to that club
- Returns the new membership
- Error: 404 if code not found, 409 if already in that club
- No auth required (public endpoint, rate-limited)

### 2. Invite link (optional, future)
Not in scope; deferred to post-launch. Model: officer generates a one-time token, shares link, student uses it once, token expires.

### 3. Leave club
- `POST /api/clubs/{clubId}/leave` — current user leaves (if not the last admin)
- Sets `members.left_at` instead of deleting — v15 migration
- Returns 400 if the user is the last admin of that club (prevent orphaned clubs)
- Returns 404 if not a member
- Audit trail: logs `member.left_club`

## Schema Changes (v15, deferred to PR 3)

For now, PR 2 works with the v14 schema. When the portfolio ships (PR 3), v15 will add:
- `clubs.join_code` and related indexes
- `members.left_at` to track leavers without deleting

Until then, PR 2 uses in-memory or temporary handling for join codes, or defers that feature to v15.

## Routes Implemented

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| POST | `/api/auth/switch-club` | signed-in | `{clubId}` | 200 `AuthMeResponse` with new active club |
| GET | `/api/auth/me` | signed-in | — | 200 `AuthMeResponse` with `memberships` array |

## Routes Deferred to PR 3

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| POST | `/api/clubs/join` | public, rate-limited | `{joinCode}` | 200 new `ClubMembership` |
| POST | `/api/clubs/{id}/leave` | signed-in | — | 200 `{ok:true}` |

## UI Implemented

1. **Shell sidebar:** ClubSwitcher dropdown under `.sidebar-profile` showing all memberships with active indicator
2. Only displays if user has more than one club
3. Light/dark theme support via CSS custom properties
4. Error handling during club switch with user feedback

## Tests

### Implemented
- Club switcher component renders only when 2+ memberships
- Switch-club endpoint verifies membership in target club (403 if not member)
- /api/auth/me returns memberships array with correct club names and roles

### Deferred to PR 3
- Joining with a valid code adds the person to that club
- Joining twice returns 409
- Joining an invalid code returns 404
- Leaving a club removes active membership; records stay (audit trail)
- Leaving the last admin's club returns 400
- After leave, person is not in that club's member list
- Join code is unique per club

## Delivery Status

### PR 2 (Current) ✅ Complete
- ✅ Club switcher UI component in shell.tsx sidebar-profile
- ✅ POST /api/auth/switch-club endpoint with membership verification
- ✅ GET /api/auth/me updated to return memberships array
- ✅ listMemberships function in identity module
- ✅ ClubMembership interface added to contracts
- ✅ CSS styling with dark theme support
- ✅ All tests passing (115 pass)

### PR 3 (Next)
1. Create v15 migration: add clubs.join_code and members.left_at columns
2. Routes: `/api/clubs/join` and `/api/clubs/{id}/leave`
3. Tests: join/leave flows with new schema
4. Docs: update API.md and HTTP-API.md

## Notes

- Switch-club works with current v14 schema; no migration required
- Join code and leave-club features require v15 migration (deferred to PR 3)
- Leave is soft-delete via left_at column, so person can re-join later
