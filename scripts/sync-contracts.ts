import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function syncContracts() {
  const sourcePath = resolve("src/lib/contracts.ts");
  const targetPath = resolve("client/src/contracts.ts");
  const names = ["Role", "SessionUser", "AuthResponse", "MemberPass", "Event", "EventStatus", "EventDetails", "TicketStatus", "Ticket", "ScanOutcome", "ScanResult", "PublicTicket"];
  const source = await readFile(sourcePath, "utf8");
  const blocks = names.map((name) => {
    const expression = new RegExp(`export (?:type|interface) ${name}\\b(?:\\s*=\\s*[^;]+;|[^{]*\\{[\\s\\S]*?^\\})`, "m");
    const block = source.match(expression)?.[0];
    if (!block) throw new Error(`Could not find ${name} in ${sourcePath}`);
    return block;
  });
  const generated = `/** Generated from src/lib/contracts.ts by scripts/sync-contracts.ts. */\n${blocks.join("\n\n")}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(targetPath, "utf8").catch(() => "");
    if (current !== generated) throw new Error("client/src/contracts.ts is stale. Run npm run sync-contracts.");
  } else await writeFile(targetPath, generated);
}
void syncContracts();
