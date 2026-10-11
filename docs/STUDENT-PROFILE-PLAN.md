# Student portfolio — plan

Status: proposal, 11 October 2026. Nothing here is implemented yet.

## Goal

Give every student a **portfolio that works as a second resume**: a shareable page and PDF that shows what they actually did in college clubs. It is built from **real records MODE already keeps** (events attended, tasks delivered, roles held, events organised), not from what the student types in. A recruiter, placement cell or admissions panel can trust it because every verified line links back to a record and can be checked.

It must fit three kinds of colleges: **engineering**, **MBA** and **medical**. The college type comes from the **student's own college** (`people.college_id`), not from whichever club they are viewing. A medical student in an inter-college robotics club still gets a medical portfolio. The college type changes the header, the academic fields and how achievements are worded and grouped. It does not change the verification rules.

**Out of scope:** marks, CGPA, attendance and exam results ([TEAM.md](TEAM.md) keeps academics outside the MVP). We show who the student is and what they contributed, not how they scored.

**Decision (11 Oct 2026): one student, many clubs.** A portfolio covers every club the student belongs to. This needs the identity change below, which ships first.

## Identity: one person, many club memberships

Today `members` mixes two things: the **person** (name, email, password) and their **membership of one club** (role, dues, expiry, door code). `members.email` is globally unique, so one person can't join two clubs.

**Approach: add `people` above `members` and keep `members` as the membership row.**

```
people (1) ──< members (many, one per club) >── clubs
   │               │
   │               └── tickets, tasks, dues, orders, expenses, sessions … (19 FKs, unchanged)
   └── student_profiles, portfolio_entries (person-level)
```

Why this shape:
- All 19 foreign keys that reference `members(id)` stay valid. Tickets, tasks, dues, orders, expenses, notifications and audit rows still point at a club-scoped membership, which is what they mean.
- `Actor` already carries `memberId` + `clubId`, and every module already scopes to `clubId`. The modules need no changes. Only identity, auth and the login flow change.
- The portfolio becomes "every `members` row for this `person_id`".

### Schema changes (migration v14, table rebuild)

```sql
CREATE TABLE people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,     -- login identity moves here
  password_hash TEXT,
  created_at TEXT NOT NULL
);

-- members: rebuilt (SQLite cannot drop a UNIQUE column constraint in place)
--   + person_id TEXT NOT NULL REFERENCES people(id)
--   - UNIQUE(email)            → UNIQUE(club_id, person_id)
--   - password_hash            → moved to people (column kept NULL for one release, then dropped)
--   name/email kept as a read-only copy, updated only by identity, so existing queries and
--   the PostgreSQL export keep working
CREATE UNIQUE INDEX members_person_club_idx ON members (club_id, person_id);
CREATE INDEX members_person_idx ON members (person_id);

-- sessions unchanged: a session points at one membership, and the person is reached through it
```

Backfill: one `people` row for each existing member, copying its id, name, email and password hash. Today emails are unique, so this is 1:1 and safe. Set `members.person_id` for every row. `login_attempts` stays keyed by email, which now means the person.

### Auth and flows

| Flow | Today | After |
|---|---|---|
| Login | email → member → session(club) | email → person → if 1 membership, open it; if several, open the last-used club |
| Switch club | — | `POST /api/auth/switch-club {clubId}` re-points the session's `member_id`/`club_id` to the person's membership in that club (403 if not a member), with an audit event |
| `GET /api/auth/me` | member | person + `memberships: [{clubId, clubName, role, membership}]` + active club |
| Officer adds member by email | creates member; 409 if email is used anywhere | if the person exists, add a membership to *this* club only; no password is set or revealed; 409 only if they're already in this club |
| Self-register | new member in the default club | new person + membership; if the email already exists, ask them to log in and use "Join club" |
| Join another club | — | invite link or club join code (`clubs.join_code`, rotatable) → creates a `members` row with role `member` and unpaid dues |
| Leave club | — | membership keeps its history (records still reference it) and is marked `left_at`; it drops out of the club's active member list |
| Change name/email/password | on member | on person; identity updates the copies on `members` |

### Rules that stay per club

- **Role, dues, expiry and the door QR are per membership.** Someone can be an Organizer in the Robotics Club and an ordinary member in the Music Club, with separate passes.
- **Officers only see their own club.** An officer in club A can't see the student's activity in club B. The only exception is the portfolio the student chooses to share, which shows everything they allowed.
- The workspace shell gets a **club switcher** in the sidebar profile area (`src/app/app/_components/shell.tsx`), similar to switching accounts or workspaces in other apps.

### Tests for the split

- Backfill gives every member exactly one person with the same login.
- The same email can join two clubs.
- Joining the same club twice → 409.
- Switching to a club the person doesn't belong to → 403.
- A session in club A can't read club B data after a switch-back race.
- An officer adding an existing email doesn't change or leak that person's password.
- The PostgreSQL export and schema dump stay green.

## Core principle: verified vs self-reported

| Tier | Source | Student can edit? | Badge |
|---|---|---|---|
| **Verified** | Derived from MODE records (tickets, tasks, roles, audit trail) | Only hide/show, never change | ✓ Verified by *Club name* |
| **Endorsed** | Written by an officer about the student (e.g. "Led sponsorship for TechFest") | No; the student can only accept or hide it | Endorsed by *officer name, role* |
| **Self-reported** | Student adds it (projects, skills, certifications, links) | Yes | No badge, and labelled "Self-reported" |

Verified and endorsed entries are what make this better than a normal resume. Self-reported entries are allowed so the page is complete, but they are never shown as if they were verified.

## What "real data" exists today

| Portfolio entry | Source in the current schema | Verified when |
|---|---|---|
| Club membership and tenure | `members.joined_at`, `dues_payments` | Paid membership periods |
| Roles held (Volunteer → Organizer → Treasurer → Admin) | `audit_events` `member.role_changed` + current `members.role` | Role-change event exists |
| Events attended | `tickets` with `checked_in_at` set | Checked in at the door, not just booked |
| Volunteer tasks delivered | `tasks` with `assignee_id` and `status = 'done'`, completion time from `audit_events` `task.status_updated` | Marked done (and the event linked, if any) |
| Events organised | `audit_events` `event.created` / `event.updated` actor | Officer actor on the event |
| Announcements published | `announcements.published_by` | Row exists |
| Treasury work | `audit_events` `expense.paid`, `dues.recorded` (counts only, never amounts) | Role was treasurer |

Gaps to close in the first PR:
- Tasks have no `completed_at` column. Add one and backfill it from the audit trail.
- `events` has no `organizer_id` column, so organisers are only known from the audit trail. Add `events.lead_member_id` so ownership is explicit.
- Events have no category. Add `events.category` (technical / cultural / sports / social service / academic / career) so the portfolio can group them.

## College-type shaping

Each college type uses the same data with different wording and emphasis.

| | Engineering | MBA | Medical |
|---|---|---|---|
| Header line | B.Tech CSE · 3rd year | MBA 2025–27 · Finance | MBBS · Phase II |
| Lead section | Projects & technical events | Leadership & initiatives | Community health & service |
| Event categories shown first | technical, hackathon, workshop | career, case competition, management | health camp, social service, academic/CME |
| Task wording | "Built / ran …" | "Led / managed …" | "Volunteered at / organised …" |
| Self-reported extras | GitHub, projects, tech stack | Work experience, internships, LinkedIn | Research, camps, council reg. no. (private) |

### Academic header fields (stored on the student profile)

Common fields: programme, specialization, admission year, optional roll number, section. Year of study is **derived** from the admission year and the session start date, the same way membership is derived from expiry, so it never goes stale.

- **Engineering:** branch (CSE/IT/ECE/EEE/ME/CE/…), lateral entry, GitHub/portfolio URL. Shown as year 1–4 and semester 1–8.
- **MBA:** major and optional second major, months of prior work experience, undergraduate degree, LinkedIn. Shown as a batch (2025–27) and term 1–6.
- **Medical:** programme (MBBS/BDS/Nursing/MD/MS), PG department, internship start date, council registration number (always private). MBBS is shown as Phase I → II → III-1 → III-2 → Internship.

## Data model (migration v15, after the identity split)

`colleges` and `people.college_id` ship here (v15), not in the identity PR. Portfolio tables are keyed by **person**, so they cover every club. Endorsements stay keyed by **membership**, because they are given by one club.

```sql
CREATE TABLE colleges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('engineering', 'mba', 'medical')),
  city TEXT,
  session_start_month INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL
);
ALTER TABLE clubs  ADD COLUMN college_id TEXT REFERENCES colleges(id);  -- the club's host college
ALTER TABLE tasks  ADD COLUMN completed_at TEXT;
ALTER TABLE events ADD COLUMN category TEXT;
ALTER TABLE events ADD COLUMN lead_member_id TEXT REFERENCES members(id);

CREATE TABLE student_profiles (          -- academic header + portfolio settings (one per person)
  person_id TEXT PRIMARY KEY REFERENCES people(id),
  college_type TEXT NOT NULL CHECK (college_type IN ('engineering', 'mba', 'medical')),
  program TEXT NOT NULL,
  specialization TEXT,
  admission_year INTEGER NOT NULL,
  enrollment_no TEXT,
  headline TEXT,                         -- one line, max 120 chars
  details TEXT NOT NULL DEFAULT '{}',    -- type-specific JSON, zod-validated
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'link', 'college')),
  share_token TEXT UNIQUE,               -- random; rotate to revoke old links
  hidden_items TEXT NOT NULL DEFAULT '[]', -- verified item keys the student chose to hide
  updated_at TEXT NOT NULL
);

CREATE TABLE portfolio_entries (         -- self-reported items
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id),
  kind TEXT NOT NULL CHECK (kind IN ('project', 'skill', 'certification', 'internship', 'award', 'publication', 'link')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  started_on TEXT, ended_on TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE endorsements (              -- officer-written, attributed
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  member_id TEXT NOT NULL REFERENCES members(id),   -- the endorsed membership (club-scoped)
  author_id TEXT NOT NULL REFERENCES members(id),   -- officer membership in the same club
  body TEXT NOT NULL,                    -- max 500 chars
  event_id TEXT REFERENCES events(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'hidden')),
  created_at TEXT NOT NULL,
  CHECK (author_id <> member_id)
);
-- endorsements: the app also rejects an author whose person_id equals the endorsed person_id
```

Verified entries are **computed on read** across all of the person's memberships (`members WHERE person_id = ?`) and grouped by club. They are never copied into a table. That way they can't drift out of sync with the records, and a cancelled or reversed record disappears from the portfolio automatically.

## Verification for outsiders

- Each public portfolio has a URL `/p/{share_token}` and a QR code on the PDF.
- Each verified line has a stable key (for example `checkin:{ticket_id}` or `task:{task_id}`). The public page shows "Verified by *Club*, *date*" and links to `/p/{token}/verify/{key}`. That page confirms the record exists without exposing other students, payments or emails.
- The PDF footer carries a generated-at timestamp and a short hash, so a printed copy can be checked against the live page.

## Privacy rules

- The default visibility is **private**. A portfolio is only shared once the student turns sharing on.
- The public page never shows email, phone, council number, roll number, payment amounts or other students' names.
- The student can hide any verified item but cannot edit it. Endorsements only appear after the student accepts them.
- Rotating `share_token` immediately breaks old links.
- Officers can only see portfolios of members of their own club.

## API

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/portfolio` | self | Full portfolio: header, verified items, endorsements, self-reported items |
| `PUT /api/portfolio/profile` | self | Academic header, headline, visibility |
| `POST/PATCH/DELETE /api/portfolio/entries[/id]` | self | Self-reported items |
| `POST /api/portfolio/hide` | self | Hide or show a verified item |
| `POST /api/portfolio/share-token` | self | Create or rotate the share link |
| `POST /api/members/[id]/endorsements` | officers | Write an endorsement (audited) |
| `PATCH /api/portfolio/endorsements/[id]` | self | Accept or hide an endorsement |
| `GET /api/public/portfolio/[token]` | anyone | Public view (rate-limited, no PII) |
| `GET /api/public/portfolio/[token]/verify/[key]` | anyone | Confirm a single item |
| `GET /api/portfolio/pdf` | self | Resume-style PDF |

## UI

- **`/app/portfolio`** (workspace): live preview on one side, editor on the other. Verified items are listed with a hide toggle, and there is an "Add project / skill / certification" button and a share panel with link, QR and visibility.
- **`/p/[token]`** (public): a clean one-page layout using the existing look, organised in the order set by the college type.
- **PDF:** A4, one or two pages, the same sections, with a QR code for verification.
- **Officer member page:** an "Endorse" button and a read-only portfolio tab.
- **Nudges:** after a check-in or a finished task, show "Added to your portfolio ✓". That moment is when students start to care about it.

## Delivery

| PR | Scope |
|---|---|
| 1 | **Identity split (v14):** `people`, rebuild `members` with `person_id` and per-club uniqueness, backfill, login via person, `/api/auth/me` memberships, `switch-club`, audit events — *implemented* |
| 2 | **Join flows:** officer adds an existing person, club join code / invite link, leave club, club switcher in the web shell |
| 3 | **Portfolio schema (v15):** `student_profiles`, `portfolio_entries`, `endorsements`, `tasks.completed_at` backfill, event category and lead, year/phase derivation with tests |
| 4 | Portfolio module: build verified items across memberships, self-reported entries, hide list, `/api/portfolio*`, contracts, HTTP-API docs |
| 5 | Workspace `/app/portfolio` editor and preview |
| 6 | Public `/p/[token]`, verify endpoint, share-token rotation, rate limiting |
| 7 | Endorsements (officer write, student accept) |
| 8 | PDF export with QR |
| 9 | Expo client: club switcher and portfolio screen |

PR 1 is the risky one because it rebuilds the most-referenced table. Ship it alone, with a backup and restore check in the PR description and the `legacy-migration` tests extended.

Tests to write first:
- A booked but not checked-in ticket does not appear.
- A task only appears once it is done, and it disappears when reopened.
- Role history is rebuilt from audit events.
- The public view leaks no PII and no other members.
- Rotating the token kills the old link.
- A hidden item is gone from the public view but stays in the owner's view.
- An officer cannot endorse a member of another club, or themselves.
- Self-reported items never carry the verified badge.

## Open questions

1. ~~One club or many?~~ **Decided: many clubs per student** (see Identity).
2. Should the college placement cell get its own role, able to browse portfolios with `visibility = 'college'`?
3. Are endorsements limited to officers, or can faculty advisors write them too (which would need a faculty role)?
4. Do we want a minimum bar for a verified item, for example an event counting only if it lasts ≥1 hour or a task only if it is linked to an event?
5. Can a student's clubs belong to different colleges (inter-college clubs)? The plan allows it. The portfolio always uses the student's own college type.
6. Should old historical data (imported ledgers and seeded registrations) count as verified, or only records created in MODE?
