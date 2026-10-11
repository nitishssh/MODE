import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifests = [
  ["package.json", { version: ["version"] }],
  [
    "package-lock.json",
    { version: ["version"], 'packages[""].version': ["packages", "", "version"] },
  ],
  ["client/package.json", { version: ["version"] }],
  [
    "client/package-lock.json",
    { version: ["version"], 'packages[""].version': ["packages", "", "version"] },
  ],
  ["client/app.json", { "expo.version": ["expo", "version"] }],
];

try {
  const version = (await readFile(new URL("VERSION", root), "utf8")).trim();
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("VERSION must contain MAJOR.MINOR.PATCH without prefixes or leading zeroes.");
  }

  const mismatches = [];
  for (const [file, fields] of manifests) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(new URL(file, root), "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${error.message}`);
    }

    for (const [label, keys] of Object.entries(fields)) {
      const actual = keys.reduce((value, key) => value?.[key], manifest);
      if (actual !== version) {
        mismatches.push(
          `${file} ${label}: expected ${version}, found ${JSON.stringify(actual) ?? "missing"}`,
        );
      }
    }
  }

  if (mismatches.length) throw new Error(mismatches.join("\n"));
  console.log(`Product version ${version} matches all root, client and Expo manifests.`);
} catch (error) {
  console.error(`Version check failed: ${error.message}`);
  process.exitCode = 1;
}
