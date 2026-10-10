import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openClubDatabase, SCHEMA_VERSION } from "../src/lib/database";
import { postgresExport } from "../src/lib/db/postgres";

/**
 * Export the SQLite database (schema + data) as a PostgreSQL load script.
 *
 *   npm run postgres:export                  writes .data/mode.postgres.sql
 *   npm run postgres:export -- --out x.sql   custom output path
 *   npm run postgres:export -- --replace     prefix DROP TABLE ... CASCADE so the script re-runs
 *   npm run postgres:export -- --schema-only no data rows
 *   npm run postgres:export -- --skip sessions,audit_events   keep those tables empty
 *   npm run postgres:push                    export, then load with psql using DATABASE_URL
 *
 * The source database is SQLITE_PATH (default .data/mode.sqlite); it is opened through the
 * application so a database behind on migrations is brought up to date first.
 * No npm dependency is used. Loading needs `psql` on PATH, or the docker-compose service
 * (`npm run postgres:up`) which the script falls back to when psql is missing.
 */
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const sqlitePath = option("--sqlite") ?? process.env.SQLITE_PATH ?? ".data/mode.sqlite";
const out = resolve(option("--out") ?? ".data/mode.postgres.sql");
const skip = (option("--skip") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const schemaOnly = flag("--schema-only");

const db = openClubDatabase(sqlitePath);
let script: string;
try {
  // The composed database object does not expose the raw handle; export through a second
  // read of the same file so the export sees exactly what the application migrated.
  const raw = new DatabaseSync(sqlitePath === ":memory:" ? ":memory:" : resolve(sqlitePath), { readOnly: sqlitePath !== ":memory:" });
  try {
    const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
    script = postgresExport(raw, { version: SCHEMA_VERSION, replace: flag("--replace"), skipData: schemaOnly ? tables : skip });
  } finally {
    raw.close();
  }
} finally {
  db.close();
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, script);
const rows = /-- (\d+) row\(s\) across/.exec(script)?.[1] ?? "0";
console.log(`Wrote ${out} (schema version ${SCHEMA_VERSION}, ${rows} rows${schemaOnly ? ", schema only" : ""}).`);

if (flag("--push")) {
  const url = process.env.DATABASE_URL;
  const psqlArgs = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", out];
  try {
    if (url) {
      execFileSync("psql", [url, ...psqlArgs], { stdio: "inherit" });
    } else {
      // Local docker-compose service: stream the file into psql inside the container.
      execFileSync("docker", ["compose", "-f", "docker-compose.postgres.yml", "exec", "-T", "postgres", "psql", "-U", "mode", "-d", "mode", "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
        input: script,
        stdio: ["pipe", "inherit", "inherit"],
      });
    }
    console.log(url ? "Loaded into DATABASE_URL." : "Loaded into the docker-compose postgres service.");
  } catch (error) {
    console.error("Load failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
