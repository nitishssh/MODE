import { readFileSync } from "node:fs";
import { openClubDatabase } from "../src/lib/database";
import { DEFAULT_CLUB_ID } from "../src/lib/db/migrations";
import { ROLES, type Role } from "../src/lib/auth/permissions";

/**
 * Import an existing member register from CSV.
 *
 *   npm run club:import -- members.csv [--dry-run]
 *
 * Header row required. Columns: name, email (required); role (member|volunteer|organizer|
 * treasurer|admin), expires_on (YYYY-MM-DD; the member is treated as paid through that club
 * date, no ledger entry is posted), password (optional login; at least 8 characters).
 * Existing emails are skipped, never overwritten. DATABASE_URL or SQLITE_PATH selects the database.
 */
const file = process.argv.slice(2).find((value) => !value.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!file) {
  console.error("club:import: give the CSV path, for example `npm run club:import -- members.csv`.");
  process.exit(1);
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
function parseCsv(textContent: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < textContent.length; i++) {
    const ch = textContent[i];
    if (quoted) {
      if (ch === '"') {
        if (textContent[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && textContent[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const content = readFileSync(file, "utf8").replace(/^﻿/, "");
const [header, ...lines] = parseCsv(content);
if (!header) { console.error("club:import: the file is empty."); process.exit(1); }
const columns = header.map((cell) => cell.trim().toLowerCase().replace(/[\s-]+/g, "_"));
const col = (nameOf: string) => columns.indexOf(nameOf);
if (col("name") === -1 || col("email") === -1) {
  console.error(`club:import: the header must include name and email columns (found: ${columns.join(", ")}).`);
  process.exit(1);
}

const target = process.env.DATABASE_URL || process.env.SQLITE_PATH || ".data/mode.sqlite";
const db = openClubDatabase(target);
let created = 0, skipped = 0, failed = 0;
try {
  if (db.getClub(DEFAULT_CLUB_ID)?.demo) {
    console.warn("club:import: this database still holds the fictional sample records; run `npm run club:init -- … --reset` first if you want a clean register.");
  }
  lines.forEach((cells, index) => {
    const line = index + 2;
    const value = (nameOf: string) => { const i = col(nameOf); return i === -1 ? "" : (cells[i] ?? "").trim(); };
    const name = value("name"), email = value("email").toLowerCase();
    const roleText = value("role").toLowerCase();
    const role = roleText ? (roleText as Role) : undefined;
    const expiresOn = value("expires_on") || value("expires") || undefined;
    const password = value("password") || undefined;
    if (role && !ROLES.includes(role)) { failed++; console.error(`line ${line}: unknown role "${roleText}" (use ${ROLES.join(", ")}).`); return; }
    if (dryRun) { console.log(`line ${line}: would import ${name} <${email}>${role ? ` as ${role}` : ""}${expiresOn ? `, paid through ${expiresOn}` : ""}${password ? ", with login" : ""}`); return; }
    try {
      const member = db.importMember({ name, email, role, expiresOn, password }, DEFAULT_CLUB_ID);
      if (!member) { skipped++; console.log(`line ${line}: ${email} already exists, skipped.`); return; }
      created++;
      console.log(`line ${line}: added ${member.name} <${member.email}> (${member.role}${member.expiresOn ? `, membership through ${member.expiresOn}` : ""}).`);
    } catch (error) {
      failed++;
      console.error(`line ${line}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
} finally {
  db.close();
}
console.log(dryRun ? `Dry run: ${lines.length} row(s) checked, nothing written.` : `Imported ${created}, skipped ${skipped} existing, ${failed} failed.`);
if (failed) process.exitCode = 1;
