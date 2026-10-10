import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { test } from "node:test";
import { openClubDatabase } from "../src/lib/database";
import { DEMO, FIXED_NOW, actorFor } from "./helpers";

// Healthy-contract acceptance for #5/#6: existing tests use connections sequentially.
// Two real processes wait at a shared start barrier before competing for one unit.
for (const kind of ["ticket", "order"] as const) {
  test(`simultaneous ${kind} reservations keep the last unit atomic`, { timeout: 15000 }, async () => {
    const directory = mkdtempSync(join(tmpdir(), "mode-reservation-"));
    const path = join(directory, "race.sqlite");
    const db = openClubDatabase(path, { now: () => FIXED_NOW });
    const admin = actorFor(db, DEMO.admin);
    const event = db.events.createEvent(admin, { title: "Race event", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 1, memberPricePaise: 1000, guestPricePaise: 2000 });
    const product = db.merchandise.createProduct(admin, { name: "Race cap", pricePaise: 1000, variants: [{ size: "M", stock: 1 }] });
    const id = kind === "ticket" ? event.id : product.variants[0].id;
    const workers = ["active@example.com", "expired@example.com"].map(email => fork(
      fileURLToPath(new URL("./fixtures/reservation-worker.ts", import.meta.url)), [path, kind, id, email],
      { execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"] },
    ));
    const exits = workers.map(worker => once(worker, "exit"));
    try {
      let ready = 0;
      const results = await Promise.all(workers.map(worker => new Promise<{ status: string; code?: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Reservation worker timed out")), 10000);
        worker.once("error", error => { clearTimeout(timer); reject(error); });
        worker.once("exit", code => { if (code !== 0) { clearTimeout(timer); reject(new Error(`Reservation worker exited ${code}`)); } });
        worker.on("message", message => {
          const result = message as { status: string; code?: string };
          if (result.status === "ready") {
            ready += 1;
            if (ready === workers.length) workers.forEach(child => child.send("reserve"));
          } else { clearTimeout(timer); resolve(result); }
        });
      })));
      assert.equal(results.filter(r => r.status === "reserved").length, 1);
      assert.deepEqual(results.filter(r => r.status === "rejected"), [{ status: "rejected", code: kind === "ticket" ? "sold_out" : "out_of_stock" }]);
      if (kind === "ticket") {
        assert.equal(db.events.requireEvent(admin.clubId, event.id).registered, 1);
        assert.equal(db.events.eventTickets(admin, event.id).length, 1);
      } else {
        assert.equal(db.merchandise.requireProduct(admin.clubId, product.id).stock, 0);
        assert.equal(db.merchandise.listOrders(admin).length, 1);
      }
      assert.equal(db.ledger.reconcile().entries, 3, "unpaid reservations post no income");
    } finally {
      for (const worker of workers) if (worker.exitCode === null) worker.kill();
      await Promise.allSettled(exits);
      db.close(); rmSync(directory, { recursive: true, force: true });
    }
  });
}
