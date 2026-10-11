import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as policyRoute } from "../src/app/api/privacy-policy/route";
import { POST as register } from "../src/app/api/auth/register/route";
import { PRIVACY_POLICY_VERSION, type RegisterInput } from "../src/lib/contracts";
import { getDatabase } from "../src/lib/database";
import { getPrivacyPolicy } from "../src/lib/privacy-policy";
import { getPrivacyChoice, parsePrivacyChoice, readOptionalPreference, savePrivacyChoice, writeOptionalPreference } from "../src/lib/privacy-preferences";
import { DEMO, FIXED_NOW, actorFor, apiRequest, memoryDatabase, withRouteDatabase } from "./helpers";

const applicant = { name: "Privacy Member", email: "privacy-member@example.test", password: "privacy-test-password" };

test("the public policy endpoint matches the notice and exposes its current version", async () => {
  const response = await policyRoute(apiRequest("/api/privacy-policy"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const policy = await response.json();
  assert.deepEqual(policy, getPrivacyPolicy());
  assert.equal(policy.version, PRIVACY_POLICY_VERSION);
  assert.ok(policy.sections.some((section: { title: string }) => section.title === "Camera permission"));
  assert.ok(!("secret" in policy) && !("members" in policy));
});

test("registration requires the current policy acknowledgement and records it exactly once", async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase();
    const admin = actorFor(db, DEMO.admin);
    const before = db.getMembers().length;
    for (const version of [undefined, false, true, "", "2020-01-01"]) {
      const response = await register(apiRequest("/api/auth/register", { body: { ...applicant, privacyPolicyVersion: version } }));
      assert.equal(response.status, 400);
      assert.ok((await response.json()).details.some((detail: { field: string }) => detail.field === "privacyPolicyVersion"));
      assert.equal(db.getMembers().length, before);
    }
    const body = { ...applicant, privacyPolicyVersion: PRIVACY_POLICY_VERSION };
    const response = await register(apiRequest("/api/auth/register", { body }));
    assert.equal(response.status, 201);
    const issued = await response.json();
    assert.ok(db.getActor(issued.token));
    const entries = () => db.listAudit(admin, "member").filter((entry) => entry.entityId === issued.user.id && entry.action === "member.privacy_acknowledged");
    assert.equal(entries().length, 1);
    assert.deepEqual(entries()[0].details, { policyVersion: PRIVACY_POLICY_VERSION });
    assert.equal(entries()[0].occurredAt, FIXED_NOW.toISOString());
    assert.equal((await register(apiRequest("/api/auth/register", { body }))).status, 409);
    assert.equal(entries().length, 1);
  });
});

test("domain validation and session failure cannot leave an account or acknowledgement behind", () => {
  const { db } = memoryDatabase();
  const secret = process.env.MODE_JWT_SECRET;
  try {
    const admin = actorFor(db, DEMO.admin);
    const before = db.getMembers().length;
    const auditBefore = db.listAudit(admin).length;
    assert.throws(() => db.register(applicant as RegisterInput));
    process.env.MODE_JWT_SECRET = "invalid";
    assert.throws(() => db.register({ ...applicant, privacyPolicyVersion: PRIVACY_POLICY_VERSION }), /MODE_JWT_SECRET/);
    assert.equal(db.getMembers().length, before);
    assert.equal(db.listAudit(admin).length, auditBefore);
  } finally {
    if (secret === undefined) delete process.env.MODE_JWT_SECRET;
    else process.env.MODE_JWT_SECRET = secret;
    db.close();
  }
});

function withBrowser(run: (browser: { values: Map<string, string>; writes: string[]; cookies: string[]; blockStorage: () => void; blockCookie: () => void }) => void) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  const writes: string[] = [];
  const cookies: string[] = [];
  let cookie = "";
  let storageBlocked = false;
  let cookieBlocked = false;
  const doc = { get cookie() { return cookie; }, set cookie(value: string) { cookies.push(value); if (!cookieBlocked) cookie = value.split(";")[0]; } };
  const storage = {
    getItem(key: string) { if (storageBlocked) throw new Error("Blocked"); return values.get(key) ?? null; },
    setItem(key: string, value: string) { if (storageBlocked) throw new Error("Blocked"); writes.push(key); values.set(key, value); },
    removeItem(key: string) { if (storageBlocked) throw new Error("Blocked"); values.delete(key); },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, location: { protocol: "https:" }, dispatchEvent: () => true } });
  try { run({ values, writes, cookies, blockStorage: () => { storageBlocked = true; }, blockCookie: () => { cookieBlocked = true; } }); }
  finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
  }
}

test("optional theme and drafts stay off until opt-in, and withdrawal clears only optional keys", () => {
  withBrowser(({ values, writes, cookies }) => {
    values.set("mode-theme", "dark");
    values.set("unrelated-setting", "keep");
    assert.equal(getPrivacyChoice(), null);
    assert.equal(readOptionalPreference("mode-theme"), null);
    writeOptionalPreference("mode.announcement.draft", "private draft");
    assert.equal(writes.length, 0);
    assert.equal(savePrivacyChoice("preferences"), true);
    assert.match(cookies[0], /SameSite=Lax; Secure$/);
    assert.match(cookies[0], /Max-Age=15552000/);
    assert.equal(readOptionalPreference("mode-theme"), "dark");
    writeOptionalPreference("mode.announcement.draft", "private draft");
    assert.equal(values.get("mode.announcement.draft"), "private draft");
    assert.equal(savePrivacyChoice("essential"), true);
    assert.equal(values.has("mode-theme"), false);
    assert.equal(values.has("mode.announcement.draft"), false);
    assert.equal(values.get("unrelated-setting"), "keep");
    writeOptionalPreference("mode-theme", "dark");
    assert.equal(values.has("mode-theme"), false);
  });
});

test("old or invalid preference choices default off and blocked browser storage does not break controls", () => {
  assert.equal(parsePrivacyChoice("mode_privacy=2020-01-01.preferences"), null);
  assert.equal(parsePrivacyChoice(`other_cookie=${PRIVACY_POLICY_VERSION}.preferences`), null);
  assert.equal(parsePrivacyChoice(`mode_privacy=${PRIVACY_POLICY_VERSION}.anything`), null);
  assert.equal(parsePrivacyChoice(`mode_session=unrelated; mode_privacy=${PRIVACY_POLICY_VERSION}.essential`), "essential");
  withBrowser(({ blockStorage, blockCookie }) => {
    blockCookie();
    assert.equal(savePrivacyChoice("preferences"), false);
    assert.equal(getPrivacyChoice(), null);
    blockStorage();
    assert.doesNotThrow(() => savePrivacyChoice("essential"));
    assert.equal(readOptionalPreference("mode-theme"), null);
    assert.doesNotThrow(() => writeOptionalPreference("mode-theme", "dark"));
  });
});

test("withdrawal disables optional writes immediately even if an existing consent cookie cannot be replaced", () => {
  withBrowser(({ blockCookie, values }) => {
    assert.equal(savePrivacyChoice("preferences"), true);
    writeOptionalPreference("mode-theme", "dark");
    blockCookie();
    assert.equal(savePrivacyChoice("essential"), false);
    assert.equal(getPrivacyChoice(), "essential");
    assert.equal(values.has("mode-theme"), false);
    writeOptionalPreference("mode-theme", "dark");
    assert.equal(values.has("mode-theme"), false);
  });
});
