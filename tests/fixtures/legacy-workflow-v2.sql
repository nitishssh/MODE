-- Historical workflow v2 fixture from commit f12fd9e, synthetic records only.
PRAGMA foreign_keys=OFF;
CREATE TABLE members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          joined_at TEXT NOT NULL,
          expires_on TEXT,
          dues_status TEXT NOT NULL CHECK (dues_status IN ('paid', 'unpaid'))
        );
INSERT INTO members VALUES ('demo-member-1','Asha Demo','asha@example.com','2026-09-10T08:00:00.000Z','2027-09-10','paid');
INSERT INTO members VALUES ('demo-member-2','Rohan Demo','rohan@example.com','2026-09-26T08:00:00.000Z','2027-09-26','paid');
INSERT INTO members VALUES ('demo-member-3','Meera Demo','meera@example.com','2026-10-08T08:00:00.000Z',NULL,'unpaid');
CREATE TABLE events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          starts_at TEXT NOT NULL,
          venue TEXT NOT NULL,
          capacity INTEGER NOT NULL CHECK (capacity >= 0),
          registered INTEGER NOT NULL CHECK (registered >= 0 AND registered <= capacity),
          member_price_paise INTEGER NOT NULL CHECK (member_price_paise >= 0),
          guest_price_paise INTEGER NOT NULL CHECK (guest_price_paise >= 0),
          fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0 CHECK (fundraiser_goal_paise >= 0)
        );
INSERT INTO events VALUES ('demo-event-1','Welcome Meetup','2026-10-17T08:00:00.000Z','Sample Campus · Room A',60,24,5000,10000,500000);
INSERT INTO events VALUES ('demo-event-2','Community Fundraiser','2026-10-24T08:00:00.000Z','Sample Campus · Courtyard',100,38,10000,15000,1000000);
CREATE TABLE announcements (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          published_at TEXT NOT NULL
        );
INSERT INTO announcements VALUES ('demo-announcement-1','Welcome to Skyline Student Association','These are sample records for the Skyline Student Association workspace. Add a member to try the live flow — other modules are in active development.','2026-10-09T08:00:00.000Z');
CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
          stock INTEGER NOT NULL CHECK (stock >= 0)
        );
INSERT INTO products VALUES ('demo-product-1','Skyline Club Hoodie',79900,18);
INSERT INTO products VALUES ('demo-product-2','Skyline Club T-shirt',34900,35);
CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          due_at TEXT,
          status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
          created_at TEXT NOT NULL
        );
INSERT INTO tasks VALUES ('demo-task-1','Prepare the welcome desk','Set up registration table and name badges','demo-member-1','demo-event-1','2026-10-15T08:00:00.000Z','in_progress','2026-10-05T08:00:00.000Z');
INSERT INTO tasks VALUES ('demo-task-2','Confirm the venue booking','Coordinate with facility management for room access','demo-member-2','demo-event-1','2026-10-09T08:00:00.000Z','done','2026-09-30T08:00:00.000Z');
INSERT INTO tasks VALUES ('demo-task-3','Draft the fundraiser announcement','Write and review the public-facing copy',NULL,'demo-event-2','2026-10-20T08:00:00.000Z','todo','2026-10-07T08:00:00.000Z');
INSERT INTO tasks VALUES ('demo-task-4','Set up the donation table','Position banners and payment QR codes','demo-member-1','demo-event-2','2026-10-22T08:00:00.000Z','todo','2026-10-09T08:00:00.000Z');
CREATE TABLE transactions (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          occurred_at TEXT NOT NULL
        );
INSERT INTO transactions VALUES ('demo-transaction-1','Membership dues collection','income',100000,'2026-09-26T08:00:00.000Z');
INSERT INTO transactions VALUES ('demo-transaction-2','Ticket sales — Welcome Meetup','income',120000,'2026-10-03T08:00:00.000Z');
INSERT INTO transactions VALUES ('demo-transaction-3','Stationery and supplies','expense',35000,'2026-10-07T08:00:00.000Z');
CREATE TABLE receipts (
          id TEXT PRIMARY KEY,
          uploader_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
          uploader_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          uploaded_at TEXT NOT NULL
        );
CREATE TABLE expenses (
          id TEXT PRIMARY KEY,
          submitter_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          purpose TEXT NOT NULL,
          receipt_id TEXT REFERENCES receipts(id),
          receipt_reference TEXT,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')) DEFAULT 'submitted',
          rejection_note TEXT,
          payment_reference TEXT,
          submitted_at TEXT NOT NULL,
          reviewed_at TEXT,
          paid_at TEXT
        );
INSERT INTO expenses VALUES ('demo-expense-1','demo-member-1',25000,'Printed name badges and lanyards',NULL,'INV-2026-001','demo-event-1','paid',NULL,'UPI-REF-123456','2026-09-28T08:00:00.000Z','2026-09-30T08:00:00.000Z','2026-10-02T08:00:00.000Z');
INSERT INTO expenses VALUES ('demo-expense-2','demo-member-2',18000,'Poster printing and venue banners',NULL,'INV-2026-002','demo-event-2','approved',NULL,NULL,'2026-10-05T08:00:00.000Z','2026-10-07T08:00:00.000Z',NULL);
INSERT INTO expenses VALUES ('demo-expense-3','demo-member-3',12000,'Refreshments for planning committee',NULL,NULL,NULL,'submitted',NULL,NULL,'2026-10-08T08:00:00.000Z',NULL,NULL);
INSERT INTO expenses VALUES ('demo-expense-4','demo-member-1',75000,'Photography equipment rental',NULL,'INV-2026-003','demo-event-1','rejected','Amount exceeds the approved budget. Please get prior approval for amounts over ₹500.',NULL,'2026-10-03T08:00:00.000Z','2026-10-04T08:00:00.000Z',NULL);
CREATE TABLE ledger_entries (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense_paid')),
          description TEXT NOT NULL,
          amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
          category TEXT,
          event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
          reference TEXT,
          occurred_at TEXT NOT NULL
        );
INSERT INTO ledger_entries VALUES ('demo-ledger-1','income','Membership dues collection',100000,'membership',NULL,NULL,'2026-09-26T08:00:00.000Z');
INSERT INTO ledger_entries VALUES ('demo-ledger-2','income','Ticket sales — Welcome Meetup',120000,'events','demo-event-1',NULL,'2026-10-03T08:00:00.000Z');
INSERT INTO ledger_entries VALUES ('demo-ledger-exp-1','expense_paid','Printed name badges and lanyards',25000,'expense','demo-event-1','UPI-REF-123456','2026-10-02T08:00:00.000Z');
PRAGMA user_version=2;
PRAGMA foreign_keys=ON;