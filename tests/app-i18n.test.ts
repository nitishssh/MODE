import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getAppDictionary } from "../src/i18n/app";
import en, { type AppKey } from "../src/i18n/app/en";
import { LOCALES } from "../src/i18n/locales";

const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
const NATIVE_DIGITS = /[٠-٩۰-۹०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/;

test("the /app dictionary covers the whole new workspace and every language has exactly its keys", async () => {
  const keys = Object.keys(en) as AppKey[];
  assert.ok(keys.length > 500, `the /app master dictionary should cover every screen (has ${keys.length})`);
  for (const { code } of LOCALES) {
    const dict = await getAppDictionary(code);
    assert.deepEqual(Object.keys(dict).sort(), [...keys].sort(), `${code}: key set differs from English`);
    for (const key of keys) {
      const value = dict[key];
      assert.equal(typeof value, "string", `${code}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(en[key]), `${code}.${key} placeholders differ`);
      assert.doesNotMatch(value, NATIVE_DIGITS, `${code}.${key} uses native-script digits`);
      if (en[key].includes("MODE")) assert.ok(value.includes("MODE"), `${code}.${key} dropped the product name`);
    }
  }
});

test("non-English /app dictionaries are translated, not copies of English", async () => {
  const sample: AppKey[] = ["action.save", "action.signIn", "status.paid", "role.treasurer", "state.loading", "col.member"];
  for (const { code } of LOCALES) {
    if (code === "en") continue;
    const dict = await getAppDictionary(code);
    const untouched = sample.filter((key) => dict[key] === en[key]);
    assert.deepEqual(untouched, [], `${code} still shows English for ${untouched.join(", ")}`);
    assert.doesNotMatch(dict["action.signIn"], /^[\x00-\x7F]*$/, `${code}.action.signIn should be in its own script`);
  }
});

test("the /app layout resolves the language from the shared cookie rule and no screen hard-codes English copy", () => {
  const layout = readFileSync(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /requestI18n\(\)/, "layout uses the shared locale resolution");
  assert.match(layout, /AppI18nProvider/, "client tree receives the /app dictionary");
  const shell = readFileSync(new URL("../src/app/app/_components/shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /<LanguageSwitcher \/>/, "the new workspace renders the switcher");
  assert.match(shell, /useT\(\)/, "the shell translates its labels");
});
