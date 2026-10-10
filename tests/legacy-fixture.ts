import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FIXED_NOW } from './helpers';
export function legacyFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'mode-legacy-'));
  const filename = join(directory, 'mode.sqlite');
  const receiptsDir = join(directory, 'receipts');
  const raw = new DatabaseSync(filename);
  raw.exec(readFileSync(new URL('./fixtures/legacy-workflow-v2.sql', import.meta.url), 'utf8'));
  raw.exec("INSERT INTO receipts VALUES ('legacy-receipt', 'demo-member-1', 'Historical name', 'receipt.txt', 'text/plain', 6, '2026-10-01'); UPDATE expenses SET receipt_id='legacy-receipt' WHERE id='demo-expense-2'");
  raw.close(); mkdirSync(receiptsDir); writeFileSync(join(receiptsDir, 'legacy-receipt'), 'legacy');
  return { directory, filename, receiptsDir, options: { now: () => FIXED_NOW, receiptsDir } };
}
