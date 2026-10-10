import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openClubDatabase } from "../src/lib/database";
import { demoPassword } from "../src/lib/db/migrations";

test("legacy workflow schema upgrades in place without dropping task and expense records", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-legacy-"));
  const filename = join(directory, "mode.sqlite");
  try {
    const legacy = new DatabaseSync(filename);
    legacy.exec(`
      CREATE TABLE members (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE, joined_at TEXT NOT NULL, expires_on TEXT, dues_status TEXT NOT NULL);
      CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT NOT NULL, starts_at TEXT NOT NULL, venue TEXT NOT NULL, capacity INTEGER NOT NULL, registered INTEGER NOT NULL, member_price_paise INTEGER NOT NULL, guest_price_paise INTEGER NOT NULL, fundraiser_goal_paise INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, assignee_id TEXT, event_id TEXT, due_at TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE transactions (id TEXT PRIMARY KEY, description TEXT NOT NULL, kind TEXT NOT NULL, amount_paise INTEGER NOT NULL, occurred_at TEXT NOT NULL);
      CREATE TABLE receipts (id TEXT PRIMARY KEY, uploader_id TEXT NOT NULL, uploader_name TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_at TEXT NOT NULL);
      CREATE TABLE expenses (id TEXT PRIMARY KEY, submitter_id TEXT NOT NULL, amount_paise INTEGER NOT NULL, purpose TEXT NOT NULL, receipt_id TEXT, receipt_reference TEXT, event_id TEXT, status TEXT NOT NULL, rejection_note TEXT, payment_reference TEXT, submitted_at TEXT NOT NULL, reviewed_at TEXT, paid_at TEXT);
      CREATE TABLE ledger_entries (id TEXT PRIMARY KEY, type TEXT NOT NULL, description TEXT NOT NULL, amount_paise INTEGER NOT NULL, category TEXT, event_id TEXT, reference TEXT, occurred_at TEXT NOT NULL);
      PRAGMA user_version = 2;
    `);
    const now = "2026-10-10T00:00:00.000Z";
    legacy.prepare("INSERT INTO members VALUES (?, ?, ?, ?, NULL, 'paid')").run("legacy-member", "Legacy Member", "legacy@example.com", now);
    legacy.prepare("INSERT INTO events VALUES (?, ?, ?, ?, 10, 0, 0, 0, 5000)").run("legacy-event", "Legacy event", now, "Room A");
    legacy.prepare("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, 'todo', ?)").run("legacy-task", "Keep this task", null, "legacy-member", "legacy-event", null, now);
    legacy.prepare("INSERT INTO expenses VALUES (?, ?, 2500, 'Keep this expense', NULL, NULL, ?, 'submitted', NULL, NULL, ?, NULL, NULL)").run("legacy-expense", "legacy-member", "legacy-event", now);
    legacy.close();

    const store = openClubDatabase(filename, { now: () => new Date(now) });
    assert.equal(store.getTaskById("legacy-task").title, "Keep this task");
    assert.equal(store.getExpenses().find((expense) => expense.id === "legacy-expense")?.purpose, "Keep this expense");
    assert.equal(store.login({ email: "lead@example.com", password: demoPassword() }).member.role, "admin");
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
