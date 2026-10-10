import assert from 'node:assert/strict';
import { DEFAULT_CLUB_ID } from "../src/lib/db/migrations";
import { test } from 'node:test';
import { legacyFixture } from './legacy-fixture';
import { rmSync } from 'node:fs';


import { openClubDatabase } from '../src/lib/database';
import { DEMO, actorFor } from './helpers';

test('historical v2 upgrade supports task creation, reassignment and old/new receipts', () => {
  const fixture = legacyFixture();
  let db: ReturnType<typeof openClubDatabase> | undefined;
  try {
    db = openClubDatabase(fixture.filename, fixture.options);
    const organizer = actorFor(db, DEMO.organizer), treasurer = actorFor(db, DEMO.treasurer);
    const created = db.createTask(organizer, { title: 'Post-upgrade task' });
    assert.equal(db.patchTask(organizer, created.id, { assigneeId: treasurer.memberId }).assigneeId, treasurer.memberId);
    assert.equal(db.getReceiptFile(treasurer, 'legacy-receipt')?.toString(), 'legacy');
    assert.equal(db.getExpenseById(treasurer, 'demo-expense-2').receiptId, 'legacy-receipt');
    const pdf = Buffer.from('%PDF-new');
    const receipt = db.saveReceipt(treasurer, { filename: 'new.pdf', mimeType: 'application/pdf', sizeBytes: pdf.length, data: pdf });
    assert.equal(db.getReceiptFile(treasurer, receipt.id)?.toString(), '%PDF-new');
    const claim = db.submitExpense(treasurer, { purpose: 'New supplies', amountPaise: 500, receiptId: receipt.id });
    assert.equal(claim.receiptId, receipt.id);
  } finally { db?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('historical payments import once with source identity, date and event preserved', () => {
  const fixture = legacyFixture();
  let db: ReturnType<typeof openClubDatabase> | undefined;
  try {
    for (let i = 0; i < 2; i++) {
      db = openClubDatabase(fixture.filename, fixture.options);
      const actor = actorFor(db, DEMO.treasurer);
      const payment = db.ledger.list(DEFAULT_CLUB_ID).filter(row => row.sourceType === 'expense' && row.sourceId === 'demo-expense-1');
      assert.equal(payment.length, 1);
      assert.equal(payment[0].amountPaise, 25000);
      assert.equal(payment[0].recordedBy, null, 'historical payer is unknown; never invent an officer');
      assert.equal(payment[0].occurredAt, '2026-10-02T08:00:00.000Z');
      const summary = db.getLedgerSummary(actor);
      assert.equal(summary.inflowPaise, 220000, 'do not count copied starter income twice');
      assert.equal(summary.outflowPaise, 60000, 'preserve starter expense plus historical reimbursement');
      assert.equal(db.getLedgerEntries(actor).find(row => row.id === payment[0].id)?.eventId, 'demo-event-1');
      const report = db.ledger.reconcile();
      assert.deepEqual(report.missing, []); assert.deepEqual(report.mismatched, []); assert.deepEqual(report.orphans, []);
      db.close(); db = undefined;
    }
  } finally { db?.close(); rmSync(fixture.directory, { recursive: true, force: true }); }
});
