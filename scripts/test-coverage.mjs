import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Explicit paths work on Windows and Linux without shell glob expansion.
const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(new URL("../coverage/", import.meta.url), { recursive: true });
const tests = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => `tests/${name}`);
if (tests.length === 0) throw new Error("No backend tests found.");

const result = spawnSync(process.execPath, [
  "--import", "tsx",
  "--import", "./tests/setup-env.mjs",
  "--test",
  "--experimental-test-coverage",
  "--test-coverage-include=src/**",
  "--test-reporter=spec",
  "--test-reporter=lcov",
  "--test-reporter-destination=stdout",
  "--test-reporter-destination=coverage/lcov.info",
  ...tests,
], { cwd: root, stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
