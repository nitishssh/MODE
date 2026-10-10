import assert from "node:assert/strict";
import { test } from "node:test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDatabase, openClubDatabase, SCHEMA_VERSION } from "../src/lib/database";
import { MAX_RECEIPT_SIZE_BYTES } from "../src/lib/contracts";
import { ValidationError } from "../src/lib/errors";
import { POST as upload } from "../src/app/api/receipts/route";
import { GET as download } from "../src/app/api/receipts/[id]/route";
import { POST as submit } from "../src/app/api/expenses/route";
import { GET as csv } from "../src/app/api/ledger/export.csv/route";
import { GET as source } from "../src/app/api/ledger/entries/[id]/source/route";
import { DEMO, FIXED_NOW, actorFor, apiRequest, loginCookie, receiptFor, routeParams, withRouteDatabase } from "./helpers";

async function sendFile(cookie: string, bytes: Uint8Array, name = "receipt.exe", mime = "application/octet-stream") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type: mime }));
  return upload(new Request("http://localhost:3000/api/receipts", { method: "POST", headers: { Cookie: cookie, Origin: "http://localhost:3000" }, body: form }));
}

test("simultaneous reimbursement confirmations on separate connections post once", { timeout: 15000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-payment-race-"));
  const path = join(directory, "race.sqlite");
  const db = openClubDatabase(path, { now: () => FIXED_NOW });
  const member = actorFor(db, "active@example.com"), admin = actorFor(db, DEMO.admin);
  const claim = db.submitExpense(member, { receiptId: receiptFor(db, member), amountPaise: 12345, purpose: "Concurrent payment" });
  db.approveExpense(admin, claim.id);
  const before = db.ledger.balance();
  const workers = [DEMO.admin, DEMO.treasurer].map(email => fork(
    fileURLToPath(new URL("./fixtures/reservation-worker.ts", import.meta.url)), [path, "expense", claim.id, email],
    { execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "pipe", "ipc"] },
  ));
  const exits = workers.map(worker => once(worker, "exit"));
  try {
    let ready = 0;
    const results = await Promise.all(workers.map(worker => new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Payment worker timed out")), 10000);
      worker.once("error", error => { clearTimeout(timer); reject(error); });
      worker.once("exit", code => { if (code !== 0) { clearTimeout(timer); reject(new Error("Payment worker exited " + code)); } });
      worker.on("message", message => {
        const result = message as { status: string };
        if (result.status === "ready") { if (++ready === workers.length) workers.forEach(child => child.send("pay")); }
        else { clearTimeout(timer); resolve(result.status); }
      });
    })));
    assert.deepEqual(results, ["reserved", "reserved"], "same reference succeeds as an idempotent retry");
    assert.equal(db.ledger.balance(), before - 12345);
    assert.equal(db.ledger.list().filter(e => e.sourceId === claim.id).length, 1);
    assert.deepEqual(db.ledger.reconcile().duplicates, []);
  } finally {
    for (const worker of workers) if (worker.exitCode === null) worker.kill();
    await Promise.allSettled(exits);
    db.close(); rmSync(directory, { recursive: true, force: true });
  }
});

test("receipt boundaries: detected formats, exact 5 MB, missing receipt and private attachments", async () => {
  await withRouteDatabase(async () => {
    const cookie = await loginCookie("active@example.com"), reviewer = await loginCookie(DEMO.treasurer);
    const db = getDatabase(), actor = actorFor(db, "active@example.com");
    assert.equal((await submit(apiRequest("/api/expenses", { cookie, body: { amountPaise: 100, purpose: "No attachment" } }))).status, 400);
    assert.throws(() => db.submitExpense(actor, { amountPaise: 100, purpose: "Missing file" } as never), ValidationError);
    for (const [bytes, type, ext] of [
      [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "jpg"],
      [Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), "image/png", "png"],
      [Buffer.from("%PDF-1.4 synthetic"), "application/pdf", "pdf"],
    ] as const) {
      const response = await sendFile(cookie, bytes);
      assert.equal(response.status, 201);
      const receipt = await response.json();
      assert.equal(receipt.mimeType, type);
      assert.equal(receipt.filename, "receipt." + ext);
      assert.deepEqual(readFileSync(join(process.env.SQLITE_PATH!, "..", "receipts", receipt.id + "." + ext)), bytes);
      for (const viewer of [cookie, reviewer]) {
        const result = await download(apiRequest("/api/receipts/" + receipt.id, { cookie: viewer }), routeParams({ id: receipt.id }));
        assert.equal(result.status, 200);
        assert.match(result.headers.get("Content-Disposition")!, /^attachment;/);
        assert.equal(result.headers.get("X-Content-Type-Options"), "nosniff");
        assert.equal(result.headers.get("Content-Type"), type);
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
      }
    }
    const exact = Buffer.alloc(MAX_RECEIPT_SIZE_BYTES); exact.write("%PDF-1.4");
    assert.equal((await sendFile(cookie, exact)).status, 201);
    assert.equal((await sendFile(cookie, Buffer.concat([exact, Buffer.from("x")]))).status, 413);
    // Also exercise the streaming body cap, beyond the multipart allowance.
    const oversizedBody = new Request("http://localhost:3000/api/receipts", {
      method: "POST", headers: { Cookie: cookie, Origin: "http://localhost:3000", "Content-Type": "multipart/form-data; boundary=test" },
      body: Buffer.alloc(MAX_RECEIPT_SIZE_BYTES + 100_000),
    });
    assert.equal((await upload(oversizedBody)).status, 413);
    for (const invalid of [Buffer.alloc(0), Buffer.from("RIFFxxxxWEBP"), Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("<script>alert(1)</script>")]) {
      assert.equal((await sendFile(cookie, invalid, "fake.png", "image/png")).status, invalid.length ? 415 : 400);
    }
    const foreignClub = db.createClub("Foreign receipts");
    db.createMemberWithCredentials({ name: "Foreign admin", email: "receipt-other@example.com", password: "receipt-test-123", role: "admin", clubId: foreignClub });
    const receiptId = receiptFor(db, actor);
    const outsider = await loginCookie("receipt-other@example.com", "receipt-test-123");
    assert.equal((await download(apiRequest("/api/receipts/" + receiptId, { cookie: outsider }), routeParams({ id: receiptId }))).status, 404);
    // A file lost after upload must not produce an apparently complete new claim.
    const path = join(process.env.SQLITE_PATH!, "..", "receipts", receiptId + ".pdf");
    rmSync(path);
    assert.equal((await submit(apiRequest("/api/expenses", { cookie, body: { amountPaise: 100, purpose: "Lost attachment", receiptId } }))).status, 404);
  });
});

test("v9 upgrade preserves extensionless receipts, IDs, ownership, claims and settled money", () => {
  const directory = mkdtempSync(join(tmpdir(), "mode-receipt-upgrade-"));
  const path = join(directory, "test.sqlite"), receipts = join(directory, "receipts");
  let db = openClubDatabase(path, { now: () => FIXED_NOW });
  try {
    const member = actorFor(db, "active@example.com"), payer = actorFor(db, DEMO.treasurer);
    const receiptId = receiptFor(db, member), contents = db.getReceiptFile(member, receiptId);
    const claim = db.submitExpense(member, { receiptId, amountPaise: 235, purpose: "Legacy invoice" });
    const linkedClaim = db.submitExpense(member, { receiptId, amountPaise: 300, purpose: "Legacy linked claim" });
    db.approveExpense(payer, claim.id); db.payExpense(payer, claim.id, "LEGACY-PAID");
    const balance = db.ledger.balance();
    db.close();
    renameSync(join(receipts, receiptId + ".pdf"), join(receipts, receiptId));
    const raw = new DatabaseSync(path);
    // Reconstruct the released v9 format, without replaying divergent migrations.
    raw.exec("ALTER TABLE expense_receipts DROP COLUMN storage_name; ALTER TABLE expense_receipts RENAME TO receipts; PRAGMA user_version=9;");
    raw.prepare("UPDATE expenses SET receipt_id = NULL WHERE id = ?").run(claim.id);
    raw.close();
    for (let attempt = 0; attempt < 2; attempt++) {
      db = openClubDatabase(path, { now: () => FIXED_NOW });
      assert.equal(db.health().schemaVersion, SCHEMA_VERSION);
      assert.deepEqual(db.getReceiptFile(member, receiptId), contents);
      assert.equal(db.getReceiptById(member, receiptId).uploaderId, member.memberId);
      assert.equal(db.getExpenseById(member, claim.id).status, "paid");
      assert.equal(db.getExpenseById(member, claim.id).receiptId, null, "history is preserved");
      assert.equal(db.getExpenseById(member, linkedClaim.id).receiptId, receiptId, "existing claim links survive table rename");
      assert.equal(db.ledger.balance(), balance);
      const check = new DatabaseSync(path);
      assert.deepEqual(check.prepare("PRAGMA foreign_key_check").all(), []);
      check.close();
      db.close();
    }
    assert.deepEqual(readdirSync(receipts), [receiptId], "upgrade never moves or duplicates a legacy file");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("receipt insert failure removes its new file and leaves no metadata", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase(), actor = actorFor(db, "active@example.com");
    const raw = new DatabaseSync(process.env.SQLITE_PATH!);
    try {
      raw.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON expense_receipts BEGIN SELECT RAISE(ABORT, 'synthetic insert failure'); END;");
      assert.throws(() => receiptFor(db, actor), /synthetic insert failure/);
      assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM expense_receipts").get()!.n, 0);
      assert.deepEqual(readdirSync(join(process.env.SQLITE_PATH!, "..", "receipts")), []);
    } finally { raw.close(); }
  });
});

// Independent CSV reader: quoted commas, doubled quotes and embedded newlines.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field); field = "";
      if (c === "\n") { rows.push(row); row = []; }
    } else if (c !== "\r" || quoted) field += c;
  }
  row.push(field); rows.push(row); return rows;
}

test("canonical CSV and source links retain exact IDs, officer names, escaped cells and reconciled totals", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase(), member = actorFor(db, "active@example.com"), admin = actorFor(db, DEMO.admin);
    const cookie = await loginCookie(DEMO.admin), memberCookie = await loginCookie("active@example.com");
    const receiptId = receiptFor(db, member);
    const purposes = ['=SUM(1,2) "test"', "+plus", "-minus", "@command", 'Text, with\n"quotes"'];
    for (const purpose of purposes) {
      const expense = db.submitExpense(member, { amountPaise: 175, purpose, receiptId });
      db.approveExpense(admin, expense.id); db.payExpense(admin, expense.id, "CSV-" + expense.id);
    }
    const dues = db.dues.recordDues(admin, { memberId: member.memberId, reference: "DUES-CSV" });
    const event = db.events.createEvent(admin, { title: "CSV gala", venue: "Hall", startsAt: "2026-11-01T13:30:00Z", capacity: 3, memberPricePaise: 123, guestPricePaise: 456 });
    const ticket = db.events.bookTicket(member, event.id); db.events.confirmTicket(admin, ticket.id, { reference: "TICKET-CSV" });
    const product = db.merchandise.createProduct(admin, { name: "CSV cap", pricePaise: 299, variants: [{ size: "M", stock: 1 }] });
    const order = db.merchandise.createOrder(member, { variantId: product.variants[0].id }); db.merchandise.confirmOrder(admin, order.id, { reference: "ORDER-CSV" });
    assert.equal((await csv(apiRequest("/api/ledger/export.csv"))).status, 401);
    assert.equal((await csv(apiRequest("/api/ledger/export.csv", { cookie: memberCookie }))).status, 403);
    const result = await csv(apiRequest("/api/ledger/export.csv", { cookie }));
    assert.equal(result.status, 200);
    const [header, ...rows] = parseCSV(await result.text());
    assert.deepEqual(header, ["date", "kind", "amount", "source_type", "source_id", "description", "recorded_by"]);
    const register = db.getLedgerEntries(admin);
    assert.equal(rows.length, register.length);
    let income = 0, expense = 0;
    for (const row of rows) {
      assert.equal(row.length, 7);
      assert.match(row[2], /^\d+\.\d{2}$/);
      if (row[1] === "income") income += Number(row[2].replace(".", "")); else expense += Number(row[2].replace(".", ""));
      if (row[3] === "opening_balance") { assert.equal(row[4], ""); assert.equal(row[6], ""); }
      else {
        const entry = register.find(e => e.sourceId === row[4])!;
        assert.ok(entry);
        assert.equal(row[6], entry.recordedByName);
        const response = await source(apiRequest("/api/ledger/entries/" + entry.id + "/source", { cookie }), routeParams({ id: entry.id }));
        assert.equal(response.status, 200);
        const details = await response.json();
        assert.equal(details.id, entry.sourceId);
        assert.equal(details.type, entry.sourceType);
        assert.ok(details.details.length > 0);
        assert.equal(JSON.stringify(details).includes("qrToken"), false);
      }
    }
    const totals = db.getLedgerSummary(admin);
    assert.deepEqual([income, expense, income - expense], [totals.inflowPaise, totals.outflowPaise, totals.balancePaise]);
    for (const purpose of purposes.slice(0, 4)) assert.ok(rows.some(row => row[5] === "'" + purpose));
    assert.ok(rows.some(row => row[5] === purposes[4]));
    for (const id of [dues.payment.id, ticket.id, order.id]) assert.ok(rows.some(row => row[4] === id));
    const entry = register.find(e => e.sourceId)!;
    assert.equal((await source(apiRequest("/api/source"), routeParams({ id: entry.id }))).status, 401);
    assert.equal((await source(apiRequest("/api/source", { cookie: memberCookie }), routeParams({ id: entry.id }))).status, 403);
    const clubId = db.createClub("Empty club");
    db.createMemberWithCredentials({ name: "Other admin", email: "csv-other@example.com", password: "csv-test-123", role: "admin", clubId });
    const other = await loginCookie("csv-other@example.com", "csv-test-123");
    assert.equal((await source(apiRequest("/api/source", { cookie: other }), routeParams({ id: entry.id }))).status, 404);
    assert.equal(parseCSV(await (await csv(apiRequest("/api/ledger/export.csv", { cookie: other }))).text()).length, 1);
    assert.deepEqual(db.ledger.reconcile().missing, []);
    assert.deepEqual(db.ledger.reconcile().mismatched, []);
  });
});
