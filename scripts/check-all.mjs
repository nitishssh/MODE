import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const checks = [
  { label: "Product version consistency", args: ["run", "check:version"] },
  { label: "Root lint", args: ["run", "lint"] },
  { label: "Backend types", args: ["run", "typecheck"] },
  { label: "API documentation contracts", args: ["run", "check:contracts"] },
  { label: "Database schema documentation", args: ["run", "schema:check"] },
  { label: "Shared client contracts", args: ["run", "check:client-contracts"] },
  { label: "Backend tests", args: ["test"] },
  { label: "Expo types", args: ["--prefix", "client", "run", "typecheck"] },
  { label: "Expo lint", args: ["run", "lint:client"] },
  { label: "Expo tests", args: ["--prefix", "client", "test"] },
  { label: "Next.js production build", args: ["run", "build"] },
  { label: "HTTP and restart acceptance", args: ["run", "test:foundation"] },
  { label: "Expo web export and staging", args: ["run", "build:client"] },
  { label: "Expo delivery build", args: ["run", "build"], expoWeb: true },
  { label: "Expo delivery acceptance", args: ["run", "test:expo-web"], expoWeb: true },
];

if (process.argv.includes("--list")) {
  for (const check of checks) {
    const mode = check.expoWeb ? " (MODE_EXPO_WEB=1)" : "";
    console.log(`${check.label}: npm ${check.args.join(" ")}${mode}`);
  }
} else {
  // npm provides its actual CLI path on Windows, macOS and Linux. Invoking it
  // with Node avoids platform-specific shells and inline environment syntax.
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this script through npm run check:all.");

  for (const [index, check] of checks.entries()) {
    console.log(`\n[${index + 1}/${checks.length}] ${check.label}`);
    const env = { ...process.env, MODE_EXPO_WEB: check.expoWeb ? "1" : "0" };
    // This sequence uses isolated SQLite fixtures. Remove inherited targets:
    // empty strings are still values for consumers that use nullish defaults.
    for (const key of Object.keys(env)) {
      if (["DATABASE_URL", "MODE_TEST_DATABASE_URL", "MODE_RECEIPTS_DIR"].includes(key.toUpperCase())) delete env[key];
    }
    const result = spawnSync(process.execPath, [npmCli, ...check.args], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(`\nFailed: ${check.label}${result.signal ? ` (${result.signal})` : ""}`);
      process.exit(result.status ?? 1);
    }
  }

  console.log("\nAll local and CI checks passed.");
}
