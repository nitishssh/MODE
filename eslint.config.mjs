import { createRequire } from "node:module";

// Reuse packages already pinned by client/package-lock.json. Both dependency
// trees must be installed before root lint runs; no global tools are required.
const requireClient = createRequire(new URL("./client/package.json", import.meta.url));
const { defineConfig, globalIgnores } = requireClient("eslint/config");
const expo = requireClient("eslint-config-expo/flat");
const typescript = requireClient("@typescript-eslint/eslint-plugin");
const globals = requireClient("globals");

export default defineConfig([
  ...expo,
  ...typescript.configs["flat/recommended"],
  { languageOptions: { globals: globals.node } },
  {
    // Node preload scripts must remain CommonJS.
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Existing legacy loading/theme effects; remove this exception when those
    // two screens are refactored. All other Hooks rules remain enforced.
    // See docs/QUALITY.md for the debt and affected effects.
    files: ["src/components/legacy-workspace.tsx", "src/app/not-found.tsx", "src/app/status/status-dashboard.tsx"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Expo app uses client/eslint.config.js and its own lint command.
    "client/**",
    "public/expo/**",
    "tmp/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
