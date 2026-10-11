import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiDoc = readFileSync(resolve("docs/API.md"), "utf8");
const requiredRoutes = [
  "/api/health",
  "/api/dashboard",
  "/api/members",
  "/api/v2/members",
  "/api/v2/tasks",
  "/api/v2/expenses",
  "/api/v2/ledger/entries",
  "/api/tasks",
  "/api/expenses",
  "/api/receipts",
  "/api/ledger/summary",
  "/api/events/{id}/report",
  "/api/announcements",
  "/api/announcements/{id}",
  "/api/announcements/{id}/outbox",
  "/api/notifications",
  "/api/clubs/join",
  "/api/clubs/join-code",
  "/api/clubs/{id}/leave",
];
const missing = requiredRoutes.filter((route) => !apiDoc.includes(route));
if (missing.length) throw new Error(`docs/API.md is missing documented routes: ${missing.join(", ")}`);
for (const phrase of ["MODE_CORS_ORIGINS", "EXPO_PUBLIC_API_URL", "Authentication status"]) {
  if (!apiDoc.includes(phrase)) throw new Error(`docs/API.md is missing required delivery documentation: ${phrase}`);
}
console.log(`Contract documentation covers ${requiredRoutes.length} route families.`);
