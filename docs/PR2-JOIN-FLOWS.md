# PR 2: Join Flows — Club Codes, Invites and Switcher

After PR 1 (identity split), a student can belong to multiple clubs. PR 2 makes it easy to join and switch between them.

## Features

### 1. Club join code (rotatable)
- Add `clubs.join_code` TEXT UNIQUE (nullable, rotatable)
- API: `POST /api/clubs/join {joinCode}` — current user adds themselves to that club
- Returns the new membership
- Error: 404 if code not found, 409 if already in that club
- No auth required (public endpoint, rate-limited)

### 2. Invite link (optional, future)
Not in PR 2 scope; deferred to post-launch. Model: officer generates a one-time token, shares link, student uses it once, token expires.

### 3. Leave club
- `POST /api/clubs/{clubId}/leave` — current user leaves (if not the last admin)
- Sets `members.left_at` instead of deleting
- Returns 400 if the user is the last admin of that club (prevent orphaned clubs)
- Returns 404 if not a member
- Audit trail: logs `member.left_club`

### 4. Club switcher (web shell)
- `.sidebar-profile` area already shows member name and initials
- Add a dropdown or modal: "Your clubs" with a list of all memberships
- Each item shows: club name, role badge, (active) label
- Click to `POST /api/auth/switch-club {clubId}` and reload
- If only one club, no switcher needed (keep it simple)

## Schema Changes (v15, deferred to PR 3)

For now, PR 2 works with the v14 schema. When the portfolio ships (PR 3), v15 will add:
- `clubs.join_code` and related indexes
- `members.left_at` to track leavers without deleting

Until then, PR 2 uses in-memory or temporary handling for join codes, or defers that feature to v15.

## Routes

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| POST | `/api/clubs/join` | public, rate-limited | `{joinCode}` | 200 new `ClubMembership` |
| POST | `/api/clubs/{id}/leave` | signed-in | — | 200 `{ok:true}` |

## UI

1. **Shell sidebar:** Under `.sidebar-profile`, after the user's name, add a button or dropdown for "Switch club" / "Your clubs"
2. **Modal/drawer:** List memberships with active indicator, click to switch
3. **Fallback:** At `/app/clubs` show a full page for club switching (backup to dropdown)

## Tests

- Joining with a valid code adds the person to that club
- Joining twice returns 409
- Joining an invalid code returns 404
- Leaving a club removes active membership; records stay (audit trail)
- Leaving the last admin's club returns 400
- Club switcher works in shell UI (click → switch)
- After leave, person is not in that club's member list
- Join code is unique per club

## Delivery order

1. Routes: `/api/clubs/join` and `/api/clubs/{id}/leave`
2. Web UI: club switcher in shell
3. Tests: join/leave/switch flows
4. Docs: update API.md and HTTP-API.md

## Notes

- No migration yet; join_code and left_at stay deferred to v15 (PR 3)
- Temporary in-memory join code storage for demo/dev, or the feature is called out as "not yet implemented" in the route
- Leave is soft-delete (left_at), so person can re-join later
