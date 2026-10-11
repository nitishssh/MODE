import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openClubDatabase } from "../src/lib/database";
import { DEFAULT_CLUB_ID } from "../src/lib/db/migrations";
import { isPostgresUrl } from "../src/lib/db/postgres-sync";

/**
 * Set up a real club: a database with no fictional records, a named club with its annual
 * dues, and one administrator who can sign in and create everything else from the workspace.
 *
 *   npm run club:init -- --name "Robotics Society" --description "NMIT robotics club" --dues 500 \
 *     --admin-name "Priya Nair" --admin-email priya@college.edu --admin-password "..." [--reset] [--force]
 *
 * --reset   Delete the existing SQLite file (and its receipts directory) first, or drop and
 *           recreate the PostgreSQL schema. Refused when the database already holds real
 *           members unless --force is also given.
 * The password may also come from MODE_ADMIN_PASSWORD so it never appears in shell history.
 * DATABASE_URL or SQLITE_PATH selects the database, as for the server.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith("--") ? "" : value;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`club:init: ${message}`);
  process.exit(1);
}

const name = arg("name")?.trim();
const description = arg("description")?.trim();
const duesRupees = arg("dues");
const adminName = arg("admin-name")?.trim();
const adminEmail = arg("admin-email")?.trim().toLowerCase();
const adminPassword = arg("admin-password") || process.env.MODE_ADMIN_PASSWORD;
if (!name) fail("--name is required (your club's name).");
if (!adminName || !adminEmail) fail("--admin-name and --admin-email are required.");
if (!adminPassword || adminPassword.length < 8) fail("Provide --admin-password (or MODE_ADMIN_PASSWORD) with at least 8 characters.");
let annualDuesPaise: number | undefined;
if (duesRupees !== undefined) {
  if (!/^\d+(\.\d{1,2})?$/.test(duesRupees) || Number(duesRupees) <= 0) fail("--dues must be a positive rupee amount, for example 500 or 499.50.");
  annualDuesPaise = Math.round(Number(duesRupees) * 100);
}

const target = process.env.DATABASE_URL || process.env.SQLITE_PATH || ".data/mode.sqlite";
const postgres = isPostgresUrl(target);

// A database created from here must not receive the fictional seed.
process.env.MODE_SEED = "none";
process.env.MODE_CLUB_NAME = name;
if (description !== undefined) process.env.MODE_CLUB_DESCRIPTION = description;

function sqliteHoldsOnlySampleData(path: string): boolean {
  const probe = openClubDatabase(path);
  try {
    const members = probe.getMembers(DEFAULT_CLUB_ID);
    const real = members.filter((member) => !member.email.endsWith("@example.com"));
    return real.length === 0;
  } finally {
    probe.close();
  }
}

if (flag("reset")) {
  if (postgres) {
    // openClubDatabase({ resetSchema: true }) drops and recreates the schema for PostgreSQL.
    if (!flag("force")) {
      const probe = openClubDatabase(target);
      const real = probe.getMembers(DEFAULT_CLUB_ID).filter((m) => !m.email.endsWith("@example.com")).length;
      probe.close();
      if (real) fail(`the PostgreSQL database holds ${real} real member(s); add --force to drop it anyway.`);
    }
  } else {
    const path = resolve(target);
    if (existsSync(path)) {
      if (!flag("force") && !sqliteHoldsOnlySampleData(path)) fail(`${path} holds real members; add --force to delete it anyway.`);
      for (const suffix of ["", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });
      rmSync(resolve(dirname(path), "receipts"), { recursive: true, force: true });
      console.log(`Removed ${path} and its receipts directory.`);
    }
  }
}

const db = openClubDatabase(target, postgres && flag("reset") ? { resetSchema: true } : {});
try {
  const before = db.getClub(DEFAULT_CLUB_ID);
  if (!before) fail("the club row is missing after migration; the database may be corrupt.");
  if (before.demo) {
    fail("this database still contains the fictional sample records. Re-run with --reset to start clean (sample data only is deleted without --force).");
  }
  db.updateClub(DEFAULT_CLUB_ID, { name, description, annualDuesPaise });
  const existing = db.getMembers(DEFAULT_CLUB_ID).find((member) => member.email === adminEmail);
  if (existing) {
    console.log(`Administrator ${adminEmail} already exists (${existing.role}); leaving the account unchanged.`);
  } else {
    const admin = db.createMemberWithCredentials({ name: adminName, email: adminEmail, password: adminPassword, role: "admin", clubId: DEFAULT_CLUB_ID });
    console.log(`Created administrator ${admin.name} <${admin.email}>.`);
  }
  const club = db.getClub(DEFAULT_CLUB_ID)!;
  console.log(`Club: ${club.name}${club.description ? ` — ${club.description}` : ""}. Annual dues ₹${(club.annualDuesPaise / 100).toFixed(2)}. Members: ${db.getMembers(DEFAULT_CLUB_ID).length}.`);
  console.log("Sign in at /app/login with the administrator account, then add members, events and products from the workspace, or run `npm run club:import -- members.csv`.");
} finally {
  db.close();
}
