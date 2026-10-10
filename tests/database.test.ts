import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DuplicateMemberError, SCHEMA_VERSION, openClubDatabase } from "../src/lib/database";
import { DEMO, actorFor } from "./helpers";

const fixedNow = () => new Date("2026-10-10T08:00:00.000Z");
// 3 starter members + 4 seeded demo officers.
const SEEDED_MEMBERS = 9; // 3 starter + 4 officers + active/expired demo members (P0)

test("member creation normalizes input, starts unpaid and rejects case-insensitive duplicates", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    const member = db.createMember({ name: "  Test Student  ", email: " STUDENT@EXAMPLE.COM " });
    assert.equal(member.name, "Test Student");
    assert.equal(member.email, "student@example.com");
    assert.equal(member.duesStatus, "unpaid");
    assert.equal(member.expiresOn, null);
    assert.equal(member.role, "member");
    assert.throws(() => db.createMember({ name: "Another Student", email: "Student@example.com" }), DuplicateMemberError);
    assert.equal(db.getMembers().length, SEEDED_MEMBERS + 1);
    assert.equal(db.getDashboard().metrics.activeMembers, 3);
  } finally {
    db.close();
  }
});

test("invalid input is rejected without adding records", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    for (const input of [
      { name: " ", email: "valid@example.com" },
      { name: "Valid Student", email: "not-an-email" },
      { name: "x".repeat(121), email: "valid@example.com" },
    ]) {
      assert.throws(() => db.createMember(input));
    }
    assert.equal(db.getMembers().length, SEEDED_MEMBERS);
  } finally {
    db.close();
  }
});

test("member records persist after reopening and migration does not duplicate seeds", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-db-test-"));
  const filename = join(directory, "nested", "mode.sqlite");
  let db: ReturnType<typeof openClubDatabase> | undefined;
  try {
    db = openClubDatabase(filename, { now: fixedNow });
    const member = db.createMember({ name: "Persistent Student", email: "persist@example.com" });
    db.close();
    db = undefined;
    db = openClubDatabase(filename, { now: fixedNow });
    assert.deepEqual(db.getMembers().find((item) => item.id === member.id), member);
    assert.equal(db.getMembers().length, SEEDED_MEMBERS + 1);
    assert.equal(db.getDashboard(actorFor(db, DEMO.treasurer)).transactions.length, 3);
    assert.equal(db.health().schemaVersion, SCHEMA_VERSION);
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("dashboard subtracts expenses in integer paise and excludes expired memberships and past events", () => {
  let date = fixedNow();
  const db = openClubDatabase(":memory:", { now: () => date });
  try {
    const treasurer = actorFor(db, DEMO.treasurer);
    const current = db.getDashboard(treasurer);
    assert.equal(current.metrics.balancePaise, 185000);
    assert.equal(
      current.metrics.balancePaise,
      current.transactions.reduce((balance, entry) => balance + (entry.kind === "income" ? entry.amountPaise : -entry.amountPaise), 0),
    );
    assert.equal(current.metrics.activeMembers, 3);
    assert.equal(current.metrics.upcomingEvents, 2);
    date = new Date("2028-01-01T00:00:00.000Z");
    assert.equal(db.getDashboard().metrics.activeMembers, 0);
    assert.equal(db.getDashboard().metrics.upcomingEvents, 0);
  } finally {
    db.close();
  }
});
