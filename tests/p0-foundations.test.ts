import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as me } from "../src/app/api/auth/me/route";
import { CROCKFORD, SHORT_CODE_LENGTH, TOKEN_COLLISION_MAX_ATTEMPTS, allocateUniqueTokens, generateQrToken, generateShortCode, normalizeShortCode } from "../src/lib/auth/tokens";
import { openClubDatabase } from "../src/lib/database";
import { clubDate } from "../src/lib/db/core";
import { ConflictError } from "../src/lib/errors";
import { MEMBERSHIP_ACTIVE_SQL, MEMBERSHIP_STATE_SQL, membershipState } from "../src/lib/modules/membership-state";
import { apiRequest, loginCookie, withRouteDatabase } from "./helpers";

const fixedNow = () => new Date("2026-10-10T08:00:00.000Z"); // 13:30 IST → club date 2026-10-10

test("membershipState: JS and SQL agree for today, yesterday and null, on the club calendar day", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    const today = clubDate(fixedNow());
    assert.equal(today, "2026-10-10");
    assert.equal(membershipState({ expiresOn: today }, today), "active", "valid through the expiry day");
    assert.equal(membershipState({ expiresOn: "2026-10-09" }, today), "expired");
    assert.equal(membershipState({ expiresOn: null }, today), "none");
    assert.equal(membershipState({ expiresOn: "2027-01-01" }, today), "active");

    // Club day boundary: 18:29 UTC is still the 9th in UTC but already the 10th in Asia/Kolkata.
    const lateNight = new Date("2026-10-09T18:31:00.000Z");
    assert.equal(clubDate(lateNight), "2026-10-10");
    assert.equal(membershipState({ expiresOn: "2026-10-09" }, clubDate(lateNight)), "expired");
    assert.equal(membershipState({ expiresOn: "2026-10-09" }, clubDate(new Date("2026-10-09T18:29:00.000Z"))), "active");

    // SQL twin returns the same answers for the same rows.
    const raw = (db as unknown as { ledger: unknown }) && openRaw();
    function openRaw() {
      return null;
    }
    void raw;
    const probe = openClubDatabase(":memory:", { now: fixedNow });
    try {
      const members = probe.getMembers();
      for (const member of members) {
        assert.equal(member.membership, membershipState(member, today), `JS derivation for ${member.email}`);
      }
      const states = { active: 0, expired: 0, none: 0 };
      for (const member of members) states[member.membership] += 1;
      assert.deepEqual(states, { active: 3, expired: 1, none: 5 }, "Asha, Rohan, Active Demo active; Expired Demo expired; Meera + officers none");
    } finally {
      probe.close();
    }
    assert.match(MEMBERSHIP_STATE_SQL, /expires_on >= \?/);
    assert.match(MEMBERSHIP_ACTIVE_SQL, /expires_on IS NOT NULL AND expires_on >= \?/);
    assert.equal(db.getDashboard().metrics.activeMembers, 3, "dashboard count uses the SQL predicate");
  } finally {
    db.close();
  }
});

test("seeded active and expired demo members can sign in and carry the right state and a pass", async () => {
  await withRouteDatabase(async () => {
    const active = await (await me(apiRequest("/api/auth/me", { cookie: await loginCookie("active@example.com") }))).json();
    assert.equal(active.pass.membership, "active");
    assert.ok(active.pass.expiresOn > "2027-07");
    assert.match(active.pass.qrToken, /^[A-Za-z0-9_-]{22}$/, "128-bit base64url");
    assert.match(active.pass.shortCode, new RegExp(`^[${CROCKFORD}]{${SHORT_CODE_LENGTH}}$`));
    const expired = await (await me(apiRequest("/api/auth/me", { cookie: await loginCookie("expired@example.com") }))).json();
    assert.equal(expired.pass.membership, "expired");
    assert.notEqual(expired.pass.qrToken, active.pass.qrToken);
    assert.notEqual(expired.pass.shortCode, active.pass.shortCode);
  });
});

test("member passes are unique, resolvable by token or typed code, and never leak the QR token in lists", () => {
  const db = openClubDatabase(":memory:", { now: fixedNow });
  try {
    const members = db.getMembers();
    assert.equal(new Set(members.map((m) => m.shortCode)).size, members.length, "short codes unique across all seeded members");
    assert.ok(members.every((m) => !("qrToken" in m)), "Member list exposes shortCode only");
    const created = db.createMember({ name: "Pass Holder", email: "pass@example.com" });
    const pass = db.getPass(created.id);
    assert.equal(pass.shortCode, created.shortCode);
    assert.equal(db.findMemberByPass("club-sample", pass.qrToken)?.id, created.id);
    assert.equal(db.findMemberByPass("club-sample", pass.shortCode.toLowerCase())?.id, created.id, "typed code is case-insensitive");
    assert.equal(db.findMemberByPass("club-sample", `${pass.shortCode.slice(0, 5)}-${pass.shortCode.slice(5)}`)?.id, created.id, "hyphens ignored");
    assert.equal(db.findMemberByPass("club-sample", created.id), null, "sequential/opaque ids never resolve");
    assert.equal(normalizeShortCode("o1il-abc"), "0111ABC");
  } finally {
    db.close();
  }
});

test("token allocation retries collisions at most five times and then fails loudly", () => {
  let calls = 0;
  const colliding = allocateUniqueTokens(
    (candidate) => {
      calls += 1;
      return candidate.shortCode === "TAKEN00000" && calls < 3;
    },
    { generate: () => ({ qrToken: generateQrToken(), shortCode: calls < 2 ? "TAKEN00000" : generateShortCode() }) },
  );
  assert.equal(calls, 3, "two collisions then success");
  assert.notEqual(colliding.shortCode, "TAKEN00000");

  let attempts = 0;
  assert.throws(
    () => allocateUniqueTokens(() => { attempts += 1; return true; }),
    (error: unknown) => error instanceof ConflictError && error.code === "token_collision",
  );
  assert.equal(attempts, TOKEN_COLLISION_MAX_ATTEMPTS);
  assert.equal(generateShortCode().length, SHORT_CODE_LENGTH);
  assert.ok([...generateShortCode()].every((ch) => CROCKFORD.includes(ch)));
  assert.equal(Buffer.from(generateQrToken(), "base64url").length, 16, "128 bits");
});
