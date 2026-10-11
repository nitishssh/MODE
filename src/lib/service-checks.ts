import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { signSessionJwt, verifySessionJwt } from "./auth/jwt";
import type { SqlDatabase } from "./db/core";

/** Small, real readiness probes. Results never include rows, file contents or credentials. */
export function createServiceChecks(db: SqlDatabase, receiptsDir: string) {
  const read = (...tables: string[]) => {
    // Names are fixed below, never supplied by an HTTP request.
    for (const table of tables) db.prepare(`SELECT id FROM ${table} LIMIT 1`).get();
  };
  return {
    auth: () => {
      read("members", "sessions");
      const now = new Date();
      const sessionId = randomUUID();
      const token = signSessionJwt("status-probe", "status-probe", sessionId, now);
      if (verifySessionJwt(token, now)?.jti !== sessionId) throw new Error("Token round trip failed");
      // No session row is inserted: this token cannot authenticate to the application.
    },
    events: () => read("events", "tickets"),
    memberships: () => read("members", "dues_payments"),
    merchandise: () => read("products", "product_variants", "merch_orders"),
    receipts: async () => {
      read("expense_receipts");
      await mkdir(receiptsDir, { recursive: true });
      const filename = join(receiptsDir, `.mode-status-${randomUUID()}.tmp`);
      const content = randomUUID();
      let created = false;
      try {
        const file = await open(filename, "wx", 0o600);
        created = true;
        try { await file.writeFile(content, "utf8"); } finally { await file.close(); }
        if (await readFile(filename, "utf8") !== content) throw new Error("Storage round trip failed");
      } finally {
        // Delete only the exact file exclusively created by this probe, never real receipts.
        if (created) await unlink(filename);
      }
    },
  };
}
