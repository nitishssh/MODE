import assert from "node:assert/strict";
import { test } from "node:test";
import { getDictionary } from "../src/i18n/dictionaries";
import en, { type DictionaryKey } from "../src/i18n/dictionaries/en";
import { createFormatters } from "../src/i18n/format";
import {
  DEFAULT_LOCALE,
  LOCALES,
  interpolate,
  isLocale,
  localeInfo,
  negotiateLocale,
  resolveLocale,
} from "../src/i18n/locales";

const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
const NATIVE_DIGITS = /[٠-٩۰-۹०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/;

test("English plus eleven of the most spoken Indian languages are registered, each with a unique code and native name", () => {
  const codes = LOCALES.map((item) => item.code);
  assert.deepEqual(codes, ["en", "hi", "bn", "mr", "te", "ta", "gu", "ur", "kn", "ml", "pa", "as"]);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(LOCALES.map((item) => item.nativeName)).size, codes.length);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(localeInfo("ur").dir, "rtl", "Urdu is the only right-to-left language in the set");
  assert.deepEqual(LOCALES.filter((item) => item.dir === "rtl").map((item) => item.code), ["ur"]);
  for (const item of LOCALES) assert.match(item.intl, /^[a-z]{2}-IN$/, `${item.code} formats with an Indian regional tag`);
});

test("every dictionary has exactly the English keys, non-empty values, matching placeholders and Latin digits", async () => {
  const keys = Object.keys(en) as DictionaryKey[];
  assert.ok(keys.length > 300, "the master dictionary covers the whole workspace");
  for (const { code } of LOCALES) {
    const dict = await getDictionary(code);
    const own = Object.keys(dict);
    assert.deepEqual(own.sort(), [...keys].sort(), `${code}: key set differs from English`);
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

test("non-English dictionaries are actually translated, not copies of English", async () => {
  const sample: DictionaryKey[] = ["auth.signIn", "nav.members", "nav.treasury", "tasks.create", "members.addMember", "treasury.approve"];
  for (const { code } of LOCALES) {
    if (code === "en") continue;
    const dict = await getDictionary(code);
    const untouched = sample.filter((key) => dict[key] === en[key]);
    assert.deepEqual(untouched, [], `${code} still shows English for ${untouched.join(", ")}`);
    assert.doesNotMatch(dict["auth.signIn"], /^[\x00-\x7F]*$/, `${code}.auth.signIn should be in its own script`);
  }
});

test("Accept-Language negotiation honours weights, regions and unknown tags", () => {
  assert.equal(negotiateLocale(null), "en");
  assert.equal(negotiateLocale(""), "en");
  assert.equal(negotiateLocale("hi-IN,hi;q=0.9,en;q=0.8"), "hi");
  assert.equal(negotiateLocale("fr-FR,fr;q=0.9"), "en", "unsupported languages fall back to English");
  assert.equal(negotiateLocale("fr;q=0.9,ta;q=0.8"), "ta", "first supported language by weight wins");
  assert.equal(negotiateLocale("en;q=0.5,bn;q=0.9"), "bn", "weights beat header order");
  assert.equal(negotiateLocale("pa-Guru-IN"), "pa", "script and region subtags match the base language");
  assert.equal(negotiateLocale("ur-PK"), "ur");
  assert.equal(negotiateLocale("*"), "en");
  assert.equal(negotiateLocale("te;q=0"), "en", "q=0 means not acceptable");
  assert.equal(negotiateLocale("garbage;;q=abc, ml"), "ml", "malformed entries are skipped");
});

test("an explicit valid cookie beats the browser preference; invalid cookies are ignored", () => {
  assert.equal(resolveLocale({ cookie: "kn", acceptLanguage: "hi-IN" }), "kn");
  assert.equal(resolveLocale({ cookie: "xx", acceptLanguage: "hi-IN" }), "hi");
  assert.equal(resolveLocale({ cookie: "", acceptLanguage: "gu" }), "gu");
  assert.equal(resolveLocale({ cookie: "<script>", acceptLanguage: null }), "en");
  assert.equal(resolveLocale({}), "en");
  assert.equal(isLocale("as"), true);
  assert.equal(isLocale("AS"), false, "codes are case-sensitive lowercase");
  assert.equal(isLocale(undefined), false);
});

test("interpolation substitutes known placeholders and leaves unknown ones visible", () => {
  assert.equal(interpolate("{name} · {role}", { name: "Asha", role: "Treasurer" }), "Asha · Treasurer");
  assert.equal(interpolate("{count} tasks", { count: 0 }), "0 tasks");
  assert.equal(interpolate("{goal} of {raised}", { raised: "₹5" }), "{goal} of ₹5");
  assert.equal(interpolate("no vars"), "no vars");
});

test("formatters localize month names and the rupee while pinning Latin digits in every language", () => {
  const iso = "2026-10-10T08:00:00.000Z";
  for (const { code } of LOCALES) {
    const fmt = createFormatters(code);
    const amount = fmt.currency(125000);
    assert.match(amount, /1,250/, `${code}: rupee amount keeps Latin digits with Indian grouping (${amount})`);
    assert.doesNotMatch(amount, NATIVE_DIGITS, `${code}: currency uses native digits (${amount})`);
    assert.equal(fmt.day(iso), "10", `${code}: day of month`);
    assert.match(fmt.date(iso), /10/, `${code}: date contains the day`);
    assert.match(fmt.date(iso), /2026/, `${code}: date contains the year`);
    assert.ok(fmt.month(iso).length > 0, `${code}: month name`);
  }
  assert.equal(createFormatters("en").currency(125000), "₹1,250.00");
  assert.equal(createFormatters("en").date(iso), "10 Oct 2026");
  assert.notEqual(createFormatters("hi").month(iso), createFormatters("en").month(iso), "month names are translated");
  assert.equal(createFormatters("en").date("2026-10-10T20:30:00.000Z"), "11 Oct 2026", "dates follow the club calendar in Asia/Kolkata");
});

test("the root layout and sign-in screen expose a language switcher wired to the cookie", async () => {
  const { readFileSync } = await import("node:fs");
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /lang=\{locale\}/, "html lang follows the resolved locale");
  assert.match(layout, /dir=\{info\.dir\}/, "html dir follows the locale direction");
  assert.match(layout, /I18nProvider/, "client tree receives the dictionary");
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<LanguageSwitcher \/>/, "workspace renders the switcher");
  assert.doesNotMatch(page, /"en-IN"/, "page no longer hard-codes the English formatter locale");
});
