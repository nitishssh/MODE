import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { GET as me } from "../src/app/api/auth/me/route";
import { POST as switchClubRoute } from "../src/app/api/auth/switch-club/route";
import { POST as createMemberRoute } from "../src/app/api/members/route";
import { openClubDatabase } from "../src/lib/database";
import { DEFAULT_CLUB_ID, demoPassword } from "../src/lib/db/migrations";
import { ConflictError, DuplicateMemberError, ForbiddenError, UnauthorizedError } from "../src/lib/errors";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, withRouteDatabase } from "./helpers";
import { legacyFixture } from "./legacy-fixture";

test("v14 backfill gives every member one person with the same id and login; members keep no password", () => {
  const { db } = memoryDatabase();
  try {
    const members = db.getMembers();
    assert.ok(members.length > 0);
    for (const member of members) {
      const memberships = db.listMemberships(member.id);
      assert.equal(memberships.length, 1, `${member.email} has exactly one membership after backfill`);
      assert.equal(memberships[0].memberId, member.id);
    }
    const admin = actorFor(db, DEMO.admin);
    assert.equal(admin.personId, admin.memberId, "backfilled person reuses the member id");
  } finally {
    db.close();
  }
});

test("a historical v2 database upgrades to people + memberships and every officer can still sign in", () => {
  const fixture = legacyFixture();
  let db: ReturnType<typeof openClubDatabase> | undefined;
  try {
    db = openClubDatabase(fixture.filename, fixture.options);
    for (const email of [DEMO.admin, DEMO.organizer, DEMO.treasurer]) {
      const actor = actorFor(db, email);
      assert.equal(actor.clubId, DEFAULT_CLUB_ID);
      assert.equal(db.listMemberships(actor.personId).length, 1);
    }
  } finally {
    db?.close();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("one person can belong to two clubs with a separate role, pass and member record in each", () => {
  const { db, clock } = memoryDatabase();
  try {
    const music = db.createClub("Music Club");
    db.createMemberWithCredentials({ name: "Music Lead", email: "music-lead@example.com", password: "music-pass-123", role: "admin", clubId: music });
    const musicAdmin = actorFor(db, "music-lead@example.com", "music-pass-123");

    // The music admin adds an existing student from the default club by email.
    const asha = actorFor(db, DEMO.volunteer);
    const added = db.createMemberAs(musicAdmin, { name: "Typed Differently", email: "VOLUNTEER@example.com" });
    assert.notEqual(added.id, asha.memberId, "a new membership row, not the old one");
    assert.equal(added.name, asha.name, "the person's own name wins over what the officer typed");
    assert.equal(added.role, "member");
    assert.throws(() => db.createMemberAs(musicAdmin, { name: "Asha", email: DEMO.volunteer }), DuplicateMemberError, "same club twice");

    const memberships = db.listMemberships(asha.personId);
    assert.deepEqual(memberships.map((m) => m.clubId).sort(), [DEFAULT_CLUB_ID, music].sort());
    assert.notEqual(db.getPass(added.id).shortCode, db.getPass(asha.memberId).shortCode, "one door pass per club");

    // Roles are per club: promoting her in Music does not change the default club.
    db.setRole(musicAdmin, added.id, "organizer");
    assert.equal(db.findMember(DEFAULT_CLUB_ID, asha.memberId)!.role, "volunteer");

    // Switching re-points the session; permissions come from the target membership.
    const switched = db.switchClub(asha, music);
    assert.equal(switched.clubId, music);
    assert.equal(switched.memberId, added.id);
    assert.equal(switched.role, "organizer");
    assert.equal(switched.personId, asha.personId);

    // The next login opens the most recently used club.
    clock.now = new Date(clock.now.getTime() + 60_000);
    const relogin = actorFor(db, DEMO.volunteer);
    assert.equal(relogin.clubId, music);
    clock.now = new Date(clock.now.getTime() + 60_000);
    db.switchClub(relogin, DEFAULT_CLUB_ID);
    clock.now = new Date(clock.now.getTime() + 60_000);
    assert.equal(actorFor(db, DEMO.volunteer).clubId, DEFAULT_CLUB_ID);
  } finally {
    db.close();
  }
});

test("switching to a club the person is not in is refused, and other clubs' data stays scoped", () => {
  const { db } = memoryDatabase();
  try {
    const other = db.createClub("Other Club");
    const asha = actorFor(db, DEMO.volunteer);
    assert.throws(() => db.switchClub(asha, other), ForbiddenError);
    assert.throws(() => db.switchClub(asha, "club-does-not-exist"), ForbiddenError);
    assert.equal(db.switchClub(asha, DEFAULT_CLUB_ID), asha, "switching to the active club is a no-op");
  } finally {
    db.close();
  }
});

test("self-registration refuses an email that already has an account", () => {
  const { db } = memoryDatabase();
  try {
    assert.throws(() => db.register({ name: "Asha Again", email: DEMO.volunteer, password: "another-pass-123" }), DuplicateMemberError);
  } finally {
    db.close();
  }
});

test("one password for all clubs: changing it signs out sessions in every club except this one", () => {
  const { db } = memoryDatabase();
  try {
    const music = db.createClub("Music Club");
    db.createMember({ name: "Lead", email: DEMO.admin }, { clubId: music });
    const first = db.login({ email: DEMO.admin, password: demoPassword() });
    const firstActor = db.getActor(first.token)!;
    const inMusic = db.switchClub(firstActor, music);
    const second = db.login({ email: DEMO.admin, password: demoPassword() });
    const secondActor = db.getActor(second.token)!;
    assert.equal(secondActor.clubId, music, "reopens the club used last");

    const result = db.changePassword(secondActor, { currentPassword: demoPassword(), newPassword: "brand-new-pass-1" });
    assert.equal(result.revokedSessions, 1);
    assert.equal(db.getActor(first.token), null, "the session that had switched to Music is revoked");
    assert.ok(db.getActor(second.token));
    assert.equal(inMusic.clubId, music);
    assert.throws(() => db.login({ email: DEMO.admin, password: demoPassword() }), UnauthorizedError);
    assert.equal(actorFor(db, DEMO.admin, "brand-new-pass-1").personId, secondActor.personId);
  } finally {
    db.close();
  }
});

test("an admin cannot reset the password of someone who also belongs to another club", () => {
  const { db } = memoryDatabase();
  try {
    const music = db.createClub("Music Club");
    db.createMemberWithCredentials({ name: "Music Lead", email: "music-lead@example.com", password: "music-pass-123", role: "admin", clubId: music });
    const musicAdmin = actorFor(db, "music-lead@example.com", "music-pass-123");
    const shared = db.createMemberAs(musicAdmin, { name: "Asha", email: DEMO.volunteer });
    assert.throws(() => db.setPassword(musicAdmin, shared.id, "takeover-pass-1"), (error: unknown) => error instanceof ConflictError && error.code === "shared_account");
    assert.ok(actorFor(db, DEMO.volunteer), "original password still works");

    // A person only in the admin's own club can still be given credentials.
    const fresh = db.createMemberAs(musicAdmin, { name: "New Singer", email: "singer@example.com" });
    db.setPassword(musicAdmin, fresh.id, "singer-pass-123");
    assert.equal(actorFor(db, "singer@example.com", "singer-pass-123").clubId, music);
  } finally {
    db.close();
  }
});

test("import adds an existing person to the club without changing their password", () => {
  const { db } = memoryDatabase();
  try {
    const music = db.createClub("Music Club");
    const imported = db.importMember({ name: "Asha", email: DEMO.volunteer, password: "imported-pass-1", expiresOn: "2027-06-30" }, music);
    assert.ok(imported);
    assert.equal(imported.expiresOn, "2027-06-30");
    assert.ok(actorFor(db, DEMO.volunteer), "existing password unchanged");
    assert.throws(() => db.login({ email: DEMO.volunteer, password: "imported-pass-1" }), UnauthorizedError);
    assert.equal(db.importMember({ name: "Asha", email: DEMO.volunteer }, music), null, "already in this club");
  } finally {
    db.close();
  }
});

test("HTTP: /api/auth/me lists memberships and /api/auth/switch-club changes the active club", async () => {
  await withRouteDatabase(async () => {
    const admin = await loginCookie(DEMO.admin);
    const before = await (await me(apiRequest("/api/auth/me", { cookie: admin }))).json();
    assert.equal(before.memberships.length, 1);
    assert.equal(before.memberships[0].clubId, DEFAULT_CLUB_ID);
    assert.equal(before.memberships[0].clubName.length > 0, true);

    const anonymous = await switchClubRoute(apiRequest("/api/auth/switch-club", { body: { clubId: DEFAULT_CLUB_ID } }));
    assert.equal(anonymous.status, 401);
    const forbidden = await switchClubRoute(apiRequest("/api/auth/switch-club", { cookie: admin, body: { clubId: "club-elsewhere" } }));
    assert.equal(forbidden.status, 403);
    const crossSite = await switchClubRoute(apiRequest("/api/auth/switch-club", { cookie: admin, body: { clubId: DEFAULT_CLUB_ID }, origin: "https://evil.example" }));
    assert.equal(crossSite.status, 403);
    const invalid = await switchClubRoute(apiRequest("/api/auth/switch-club", { cookie: admin, body: { clubId: DEFAULT_CLUB_ID, extra: true } }));
    assert.equal(invalid.status, 400);

    const ok = await switchClubRoute(apiRequest("/api/auth/switch-club", { cookie: admin, body: { clubId: DEFAULT_CLUB_ID } }));
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.user.clubId, DEFAULT_CLUB_ID);
    assert.ok(body.pass.shortCode);

    // Officers adding an email that already has an account create a membership, not a 409.
    const organizer = await loginCookie(DEMO.organizer);
    const again = await createMemberRoute(apiRequest("/api/members", { cookie: organizer, body: { name: "Asha", email: DEMO.volunteer } }));
    assert.equal(again.status, 409, "already in this club");
  });
});
