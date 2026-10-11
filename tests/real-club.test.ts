import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_VERSION } from "../src/lib/database";
import { DEFAULT_CLUB_ID } from "../src/lib/db/migrations";
import { ValidationError } from "../src/lib/errors";
import { memoryDatabase } from "./helpers";

/** Run `fn` with the real-club environment and restore the demo default afterwards. */
function withRealClubEnv<T>(fn: () => T): T {
  const saved = { seed: process.env.MODE_SEED, name: process.env.MODE_CLUB_NAME, description: process.env.MODE_CLUB_DESCRIPTION };
  process.env.MODE_SEED = "none";
  process.env.MODE_CLUB_NAME = "Robotics Society";
  process.env.MODE_CLUB_DESCRIPTION = "NMIT robotics club";
  try {
    return fn();
  } finally {
    for (const [key, value] of [["MODE_SEED", saved.seed], ["MODE_CLUB_NAME", saved.name], ["MODE_CLUB_DESCRIPTION", saved.description]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("MODE_SEED=none creates a fully migrated database with the configured club and no fictional records", () => {
  withRealClubEnv(() => {
    const { db } = memoryDatabase();
    try {
      assert.equal(db.health().schemaVersion, SCHEMA_VERSION);
      const club = db.getClub(DEFAULT_CLUB_ID);
      assert.ok(club);
      assert.equal(club.name, "Robotics Society");
      assert.equal(club.description, "NMIT robotics club");
      assert.equal(club.demo, false);
      assert.equal(db.getMembers(DEFAULT_CLUB_ID).length, 0);
      const dashboard = db.getDashboard(null);
      assert.equal(dashboard.club.demo, false);
      assert.equal(dashboard.club.name, "Robotics Society");
      assert.deepEqual([dashboard.events.length, dashboard.products.length, dashboard.announcements.length, dashboard.tasks.length], [0, 0, 0, 0]);
      assert.equal(db.ledger.list(DEFAULT_CLUB_ID).length, 0);
      assert.deepEqual(db.ledger.reconcile().missing, []);
    } finally {
      db.close();
    }
  });
});

test("the default seed still reports the sample club as demo data", () => {
  const { db } = memoryDatabase();
  try {
    assert.equal(db.getClub(DEFAULT_CLUB_ID)?.demo, true);
    assert.equal(db.getDashboard(null).club.demo, true);
  } finally {
    db.close();
  }
});

test("club:init pieces: rename the club, set dues and bootstrap an administrator who can sign in", () => {
  withRealClubEnv(() => {
    const { db } = memoryDatabase();
    try {
      db.updateClub(DEFAULT_CLUB_ID, { name: "Robotics Society", description: "Build things", annualDuesPaise: 50000 });
      assert.throws(() => db.updateClub(DEFAULT_CLUB_ID, { annualDuesPaise: 0 }));
      const admin = db.createMemberWithCredentials({ name: "Priya Nair", email: "priya@college.edu", password: "a-private-password", role: "admin", clubId: DEFAULT_CLUB_ID });
      assert.equal(admin.role, "admin");
      const session = db.login({ email: "priya@college.edu", password: "a-private-password" });
      assert.equal(session.member.id, admin.id);
      const club = db.getClub(DEFAULT_CLUB_ID)!;
      assert.equal(club.annualDuesPaise, 50000);
      assert.equal(club.demo, false);
      assert.equal(db.getDashboard(null).club.name, "Robotics Society");
    } finally {
      db.close();
    }
  });
});

test("club:import pieces: members arrive with roles and paid-through dates, duplicates are skipped, no ledger rows are posted", () => {
  withRealClubEnv(() => {
    const { db, clock } = memoryDatabase();
    try {
      const paid = db.importMember({ name: "Arjun Rao", email: "Arjun@College.edu", role: "volunteer", expiresOn: "2027-06-30" }, DEFAULT_CLUB_ID);
      assert.ok(paid);
      assert.equal(paid.email, "arjun@college.edu");
      assert.equal(paid.role, "volunteer");
      assert.equal(paid.expiresOn, "2027-06-30");
      assert.equal(paid.membership, "active");
      assert.equal(paid.duesStatus, "paid");
      assert.ok(paid.shortCode.length === 10, "imported members get a door pass");
      const plain = db.importMember({ name: "Neha Singh", email: "neha@college.edu" }, DEFAULT_CLUB_ID);
      assert.ok(plain);
      assert.equal(plain.membership, "none");
      assert.equal(db.importMember({ name: "Arjun Again", email: "arjun@college.edu" }, DEFAULT_CLUB_ID), null, "duplicate email is skipped");
      assert.throws(() => db.importMember({ name: "Bad", email: "bad@college.edu", expiresOn: "30/06/2027" }, DEFAULT_CLUB_ID), ValidationError);
      assert.throws(() => db.importMember({ name: "Bad", email: "bad2@college.edu", role: "president" as never }, DEFAULT_CLUB_ID), ValidationError);
      const login = db.importMember({ name: "Kiran Das", email: "kiran@college.edu", password: "another-password" }, DEFAULT_CLUB_ID);
      assert.ok(login);
      assert.equal(db.login({ email: "kiran@college.edu", password: "another-password" }).member.id, login.id);
      assert.equal(db.getMembers(DEFAULT_CLUB_ID).length, 3);
      assert.equal(db.ledger.list(DEFAULT_CLUB_ID).length, 0, "historical dues are not invented in the ledger");
      assert.deepEqual(db.ledger.reconcile().missing, []);
      // Membership state stays derived from the club calendar date.
      clock.now = new Date("2027-07-01T08:00:00.000Z");
      assert.equal(db.getMembers(DEFAULT_CLUB_ID).find((m) => m.id === paid.id)?.membership, "expired");
    } finally {
      db.close();
    }
  });
});
