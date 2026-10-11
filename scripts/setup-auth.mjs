import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../.env.local", import.meta.url));
const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
if (/^\s*(?:export\s+)?MODE_JWT_SECRET\s*=/m.test(existing)) {
  console.log("MODE_JWT_SECRET already exists in .env.local; kept it unchanged.");
} else {
  appendFileSync(path, `${existing && !existing.endsWith("\n") ? "\n" : ""}MODE_JWT_SECRET=${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
  console.log("Configured a private JWT signing key in .env.local. Restart the dev server to load it. Keep this file out of Git.");
}
