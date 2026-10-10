import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openClubDatabase } from "../src/lib/database";
import { DEMO, FIXED_NOW, actorFor } from "./helpers";

// Regression: ISSUE-001 — paid sources must not disappear from reconciliation.
// Found by /qa on 2026-10-10. Report: docs/ACCEPTANCE.md
// Value: protects=source-complete ledger checks; fails_when=paid sources lack matching rows;
// why_new=existing tests only follow existing ledger rows; seam=none.
test("reconciliation detects missing and mismatched entries for every money-moving source", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-reconcile-"));
  const path = join(directory, "test.sqlite");
  const db = openClubDatabase(path, { now: () => FIXED_NOW });
  const raw = new DatabaseSync(path);
  try {
    const admin = actorFor(db, DEMO.admin), member = actorFor(db, "active@example.com");
    const dues = db.dues.recordDues(admin, { memberId: member.memberId, reference: "RECON-DUES" });
    const event = db.events.createEvent(admin, { title: "Reconciliation", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 3, memberPricePaise: 1000, guestPricePaise: 2000 });
    const ticket = db.events.bookTicket(member, event.id);
    db.events.confirmTicket(admin, ticket.id, { reference: "RECON-TICKET" });
    const product = db.merchandise.createProduct(admin, { name: "Reconcile shirt", pricePaise: 1500, variants: [{ size: "M", stock: 3 }] });
    const order = db.merchandise.createOrder(member, { variantId: product.variants[0].id });
    db.merchandise.confirmOrder(admin, order.id, { reference: "RECON-ORDER" });
    db.merchandise.fulfilOrder(admin, order.id);
    const expense = db.submitExpense(member, { amountPaise: 500, purpose: "Reconcile expense" });
    db.approveExpense(admin, expense.id); db.payExpense(admin, expense.id, "RECON-EXPENSE");
    const sources = [["dues_payment", dues.payment.id], ["ticket", ticket.id], ["merch_order", order.id], ["expense", expense.id]];
    const clean = db.ledger.reconcile();
    for (const [sourceType, sourceId] of sources) {
      const original = raw.prepare("SELECT * FROM transactions WHERE source_type = ? AND source_id = ?").get(sourceType, sourceId)!;
      const restore = () => {
        raw.prepare("DELETE FROM transactions WHERE source_type = ? AND source_id = ?").run(sourceType, sourceId);
        const columns = Object.keys(original);
        raw.prepare(`INSERT INTO transactions (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(original));
      };
      // Commit corruption on this connection so the application's connection sees it.
      raw.prepare("DELETE FROM transactions WHERE source_type = ? AND source_id = ?").run(sourceType, sourceId);
      assert.deepEqual(db.ledger.reconcile().missing, [{ sourceType, sourceId }]);
      restore();
      for (const change of ["amount_paise = amount_paise + 1", "kind = CASE WHEN kind = 'income' THEN 'expense' ELSE 'income' END", "recorded_by = NULL", "club_id = 'wrong-club'"]) {
        raw.prepare(`UPDATE transactions SET ${change} WHERE source_type = ? AND source_id = ?`).run(sourceType, sourceId);
        assert.deepEqual(db.ledger.reconcile().mismatched.map(({ sourceType, sourceId }) => ({ sourceType, sourceId })), [{ sourceType, sourceId }], change);
        restore();
      }
    }
    assert.deepEqual(db.ledger.reconcile(), clean, "read-only checks must not repair or change the ledger");
    assert.deepEqual(clean.missing, []);
    assert.deepEqual(clean.mismatched, []);
    const free = db.events.createEvent(admin, { title: "Free event", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 1, memberPricePaise: 0, guestPricePaise: 0 });
    db.events.bookTicket(member, free.id);
    const gift = db.merchandise.createProduct(admin, { name: "Gift", pricePaise: 0, variants: [{ size: "M", stock: 1 }] });
    db.merchandise.createOrder(member, { variantId: gift.variants[0].id });
    db.events.bookGuestTicket(admin.clubId, event.id, { name: "Pending guest", email: "pending@example.com" });
    db.merchandise.createOrder(member, { variantId: product.variants[0].id });
    db.submitExpense(member, { amountPaise: 200, purpose: "Unpaid expense" });
    assert.deepEqual(db.ledger.reconcile(), clean, "free and unpaid sources require no income/expense row");
  } finally { raw.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});
