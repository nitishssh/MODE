import assert from "node:assert/strict";
import { test } from "node:test";
import { openClubDatabase } from "../src/lib/database";
import { ConflictError, ValidationError } from "../src/lib/errors";
import { SOURCE_RESOLVERS } from "../src/lib/modules/ledger";
import { DEMO, actorFor, memoryDatabase } from "./helpers";

const fixedNow = () => new Date("2026-10-10T08:00:00.000Z");

/**
 * Ledger reconciliation harness (P0, #2). Every financial module adds a test here
 * that moves money through its own source type and asserts a clean report.
 */
test("starter transactions are honest opening balances and the ledger reconciles cleanly", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    const report = db.ledger.reconcile();
    assert.equal(report.entries, 3);
    assert.equal(report.openingBalances, 3);
    assert.deepEqual(report.orphans, []);
    assert.deepEqual(report.duplicates, []);
    assert.equal(report.unsourced, 0);
    assert.equal(report.balancePaise, 185000);
    for (const entry of db.ledger.list()) {
      assert.equal(entry.sourceType, "opening_balance");
      assert.equal(entry.sourceId, entry.id, "an opening balance is its own source");
      assert.equal(entry.recordedBy, null);
      assert.match(entry.description, /^Opening balance \(pre-system\): /);
    }
  } finally {
    db.close();
  }
});

test("postLedgerEntry posts each source exactly once, inside a transaction, with positive integer paise", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    const officer = db.getMembers().find((m) => m.email === "treasurer@example.com")!;
    SOURCE_RESOLVERS.test_source = (_db, sourceId) => sourceId.startsWith("ok-");

    assert.throws(() => db.ledger.post({ kind: "income", amountPaise: 100, description: "outside tx", source: { type: "test_source", id: "ok-1" }, recordedBy: officer.id }), /inside the source's transaction/);
    const before = db.ledger.balance();
    const entry = db.transaction(() =>
      db.ledger.post({ kind: "income", amountPaise: 2500, description: "Test income", source: { type: "test_source", id: "ok-1" }, recordedBy: officer.id }),
    );
    assert.equal(entry.recordedBy, officer.id);
    assert.equal(db.ledger.balance(), before + 2500);

    assert.throws(
      () => db.transaction(() => db.ledger.post({ kind: "income", amountPaise: 2500, description: "again", source: { type: "test_source", id: "ok-1" }, recordedBy: officer.id })),
      (error: unknown) => error instanceof ConflictError && error.code === "duplicate_ledger_source",
    );
    assert.equal(db.ledger.balance(), before + 2500, "the duplicate attempt rolled back");
    for (const bad of [0, -5, 12.5, Number.NaN]) {
      assert.throws(() => db.transaction(() => db.ledger.post({ kind: "expense", amountPaise: bad, description: "bad", source: { type: "test_source", id: `ok-${bad}` }, recordedBy: officer.id })), ValidationError);
    }

    // A source that disappears becomes an orphan the harness reports.
    db.transaction(() => db.ledger.post({ kind: "expense", amountPaise: 700, description: "Orphan test", source: { type: "test_source", id: "gone-1" }, recordedBy: officer.id }));
    const report = db.ledger.reconcile();
    assert.deepEqual(report.orphans.map((o) => o.sourceId), ["gone-1"]);
    assert.deepEqual(report.duplicates, []);
    assert.equal(report.balancePaise, before + 2500 - 700);
    assert.equal(report.balancePaise, db.getDashboard(db.getActor(db.login({ email: "treasurer@example.com", password: "mode-demo-2026" }).token)!).metrics.balancePaise, "dashboard and ledger agree");

    // A transaction that fails after posting leaves no ledger row behind.
    assert.throws(() =>
      db.transaction(() => {
        db.ledger.post({ kind: "income", amountPaise: 999, description: "rolled back", source: { type: "test_source", id: "ok-rb" }, recordedBy: officer.id });
        throw new Error("source transition failed");
      }),
    );
    assert.ok(!db.ledger.list().some((e) => e.sourceId === "ok-rb"), "ledger row and source commit or fail together");
  } finally {
    delete SOURCE_RESOLVERS.test_source;
    db.close();
  }
});

test("tickets (#5): a confirmed ticket posts one `ticket` income row that reconciles; holds and cancellations post nothing", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const event = db.events.createEvent(organizer, { title: "Reconcile gala", startsAt: "2026-11-01T13:30:00.000Z", venue: "Hall", capacity: 3, memberPricePaise: 5000, guestPricePaise: 10000 });
    const before = db.ledger.reconcile();
    const paid = db.events.bookTicket(actorFor(db, "active@example.com"), event.id);
    const held = db.events.bookTicket(actorFor(db, "expired@example.com"), event.id);
    const cancelled = db.events.bookGuestTicket(organizer.clubId, event.id, { name: "Cancel Me", email: "cancel@example.com" });
    db.events.confirmTicket(organizer, paid.id, { reference: "REC-1" });
    db.events.confirmTicket(organizer, paid.id, { reference: "REC-1" });
    db.events.cancelTicket(organizer, cancelled.id);
    clock.now = new Date(clock.now.getTime() + 31 * 60_000);
    db.events.pendingHolds(organizer, event.id); // releases `held`

    const after = db.ledger.reconcile();
    assert.equal(after.entries, before.entries + 1, "exactly one row for the paid ticket");
    assert.equal(after.balancePaise, before.balancePaise + 5000);
    assert.deepEqual(after.orphans, []);
    assert.deepEqual(after.duplicates, []);
    assert.equal(after.unsourced, 0);
    assert.deepEqual(db.ledger.list().filter((e) => e.sourceType === "ticket").map((e) => e.sourceId), [paid.id]);
    assert.equal(db.events.eventReport(organizer, event.id).realizedRevenuePaise, 5000);
    assert.equal(db.events.myTickets(actorFor(db, "expired@example.com")).find((t) => t.id === held.id)?.status, "expired");
  } finally {
    db.close();
  }
});
