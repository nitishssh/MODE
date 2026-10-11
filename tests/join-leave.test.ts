import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as joinRoute } from "../src/app/api/clubs/join/route";
import { DELETE as disableCodeRoute, GET as joinCodeRoute, POST as rotateCodeRoute } from "../src/app/api/clubs/join-code/route";
import { POST as leaveRoute } from "../src/app/api/clubs/[id]/leave/route";
import { GET as me } from "../src/app/api/auth/me/route";
import { DEFAULT_CLUB_ID, demoPassword } from "../src/lib/db/migrations";
import { ConflictError, DuplicateMemberError, ForbiddenError, NotFoundError, UnauthorizedError } from "../src/lib/errors";
import { getDatabase, type ClubDatabase } from "../src/lib/database";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

const STUDENT = { email: "student@example.com", password: "student-pass-123" };

/** A plain member of the default club who can sign in. */
function student(db: ClubDatabase) {
  db.createMemberWithCredentials({ name: "Student", email: STUDENT.email, password: STUDENT.password, role: "member", clubId: DEFAULT_CLUB_ID });
  return actorFor(db, STUDENT.email, STUDENT.password);
}

/** A second club with its own admin and a published join code. */
function musicClub(db: ClubDatabase) {
  const clubId = db.createClub("Music Club");
  db.createMemberWithCredentials({ name: "Music Lead", email: "music-lead@example.com", password: "music-pass-123", role: "admin", clubId });
  const lead = actorFor(db, "music-lead@example.com", "music-pass-123");
  const { joinCode } = db.rotateJoinCode(lead);
  return { clubId, lead, joinCode: joinCode! };
}

test("only club leads manage the join code; rotating replaces it and disabling turns joining off", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    for (const actor of [actorFor(db, DEMO.organizer), actorFor(db, DEMO.treasurer), actorFor(db, DEMO.volunteer), student(db)]) {
      const email = actor.email;
      assert.throws(() => db.getJoinCode(actor), ForbiddenError, `${email} cannot read the code`);
      assert.throws(() => db.rotateJoinCode(actor), ForbiddenError, `${email} cannot rotate the code`);
    }
    assert.deepEqual(db.getJoinCode(admin), { clubId: DEFAULT_CLUB_ID, joinCode: null }, "joining by code starts off");
    const first = db.rotateJoinCode(admin).joinCode!;
    assert.match(first, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    const second = db.rotateJoinCode(admin).joinCode!;
    assert.notEqual(second, first);
    assert.equal(db.getJoinCode(admin).joinCode, second);
    assert.deepEqual(db.disableJoinCode(admin), { clubId: DEFAULT_CLUB_ID, joinCode: null });
    assert.deepEqual(db.listAudit(admin, "club").map((row) => row.action).sort(), ["club.join_code_disabled", "club.join_code_rotated", "club.join_code_rotated"]);
  } finally {
    db.close();
  }
});

test("a signed-in person joins with a code as a plain member; unknown, stale and repeated joins are refused", () => {
  const { db } = memoryDatabase();
  try {
    const music = musicClub(db);
    const organizer = actorFor(db, DEMO.organizer);
    // Codes are typed leniently: lower case, spaces and hyphens are fine.
    const typed = `${music.joinCode.slice(0, 4).toLowerCase()}-${music.joinCode.slice(4)}`;
    const joined = db.joinClub(organizer, typed);
    assert.equal(joined.rejoined, false);
    assert.equal(joined.membership.clubId, music.clubId);
    assert.equal(joined.membership.role, "member", "an organizer elsewhere is a plain member here");
    assert.deepEqual(db.listMemberships(organizer.personId).map((m) => m.clubId).sort(), [DEFAULT_CLUB_ID, music.clubId].sort());
    assert.ok(db.getMembers(music.clubId).some((m) => m.id === joined.membership.memberId), "on the new club's roster");

    assert.throws(() => db.joinClub(organizer, music.joinCode), DuplicateMemberError, "already a member");
    assert.throws(() => db.joinClub(organizer, "NOTACODE"), NotFoundError);
    const rotated = db.rotateJoinCode(music.lead).joinCode!;
    const volunteer = actorFor(db, DEMO.volunteer);
    assert.throws(() => db.joinClub(volunteer, music.joinCode), NotFoundError, "the old code stops working");
    db.disableJoinCode(music.lead);
    assert.throws(() => db.joinClub(volunteer, rotated), NotFoundError, "a disabled club cannot be joined");
  } finally {
    db.close();
  }
});

test("leaving another club keeps this session; the departed membership loses roster, door, notices, dues and switching", () => {
  const { db } = memoryDatabase();
  try {
    const music = musicClub(db);
    const asha = student(db);
    const membership = db.joinClub(asha, music.joinCode).membership;
    const pass = db.getPass(membership.memberId);
    const notice = (key: string) => db.announcements.publish(music.lead, { title: "Rehearsal", body: "Thursday at six.", idempotencyKey: key }).recipientCount;
    // A plain member has no active membership until dues are paid; pay so she would receive notices.
    db.dues.recordDues(music.lead, { memberId: membership.memberId, reference: "MUSIC-DUES-1" });
    const before = notice("before-leaving");

    const result = db.leaveClub(asha, music.clubId);
    assert.deepEqual(result, { clubId: music.clubId, activeClubId: DEFAULT_CLUB_ID, signedOut: false });
    assert.equal(db.getActor(db.login(STUDENT).token)!.clubId, DEFAULT_CLUB_ID, "sign-in opens the remaining club");
    assert.deepEqual(db.listMemberships(asha.personId).map((m) => m.clubId), [DEFAULT_CLUB_ID]);
    assert.equal(db.getMembers(music.clubId).some((m) => m.id === membership.memberId), false, "off the roster");
    assert.equal(db.findMember(music.clubId, membership.memberId), null);
    assert.equal(db.findMemberByPass(music.clubId, pass.shortCode), null, "the old door pass no longer resolves");
    assert.equal(notice("after-leaving"), before - 1, "no new announcements");
    assert.throws(() => db.dues.recordDues(music.lead, { memberId: membership.memberId, reference: "MUSIC-DUES-2" }), NotFoundError);
    assert.throws(() => db.switchClub(asha, music.clubId), ForbiddenError);
    assert.throws(() => db.leaveClub(asha, music.clubId), NotFoundError, "cannot leave twice");
    assert.equal(db.dues.paymentsFor(music.clubId, membership.memberId).length, 1, "history stays");
  } finally {
    db.close();
  }
});

test("leaving the active club moves this session to another club and ends every other session on that membership", () => {
  const { db, clock } = memoryDatabase();
  try {
    const music = musicClub(db);
    const volunteer = actorFor(db, DEMO.volunteer);
    db.joinClub(volunteer, music.joinCode);
    const phone = db.login({ email: DEMO.volunteer, password: demoPassword() });
    const laptopToken = db.login({ email: DEMO.volunteer, password: demoPassword() }).token;
    const laptop = db.switchClub(db.getActor(laptopToken)!, music.clubId);
    db.switchClub(db.getActor(phone.token)!, music.clubId);
    clock.now = new Date(clock.now.getTime() + 60_000);

    const result = db.leaveClub(laptop, music.clubId);
    assert.deepEqual(result, { clubId: music.clubId, activeClubId: DEFAULT_CLUB_ID, signedOut: false });
    assert.equal(db.getActor(phone.token), null, "the other device on the departed membership is signed out");
    assert.equal(db.getActor(laptopToken)!.clubId, DEFAULT_CLUB_ID, "this session now opens the remaining club");
    assert.equal(actorFor(db, DEMO.volunteer).clubId, DEFAULT_CLUB_ID, "the next sign-in cannot open the departed club");
  } finally {
    db.close();
  }
});

test("leaving the only club signs out, and that person can no longer sign in until they join again", () => {
  const { db } = memoryDatabase();
  try {
    student(db);
    const issued = db.login(STUDENT);
    const asha = db.getActor(issued.token)!;
    assert.deepEqual(db.leaveClub(asha, DEFAULT_CLUB_ID), { clubId: DEFAULT_CLUB_ID, activeClubId: null, signedOut: true });
    assert.equal(db.getActor(issued.token), null);
    assert.throws(() => db.login(STUDENT), UnauthorizedError);
  } finally {
    db.close();
  }
});

test("the last admin cannot leave; once someone else is admin they can", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    assert.throws(() => db.leaveClub(admin, DEFAULT_CLUB_ID), ConflictError);
    db.setRole(admin, actorFor(db, DEMO.organizer).memberId, "admin");
    assert.equal(db.leaveClub(admin, DEFAULT_CLUB_ID).signedOut, true);
  } finally {
    db.close();
  }
});

test("coming back reactivates the same membership with a fresh role, whether by code or by an officer", () => {
  const { db } = memoryDatabase();
  try {
    const music = musicClub(db);
    const asha = student(db);
    const first = db.joinClub(asha, music.joinCode).membership;
    db.setRole(music.lead, first.memberId, "organizer");
    const pass = db.getPass(first.memberId);
    db.leaveClub(asha, music.clubId);

    const back = db.joinClub(asha, music.joinCode);
    assert.equal(back.rejoined, true);
    assert.equal(back.membership.memberId, first.memberId, "same membership row, so history stays attached");
    assert.equal(back.membership.role, "member", "a former organizer returns as a plain member");
    assert.equal(db.getPass(first.memberId).shortCode, pass.shortCode);

    db.leaveClub(asha, music.clubId);
    const readded = db.createMemberAs(music.lead, { name: "Asha", email: STUDENT.email });
    assert.equal(readded.id, first.memberId, "an officer re-adding them reactivates the same row");
    assert.equal(readded.role, "member");
    assert.throws(() => db.createMemberAs(music.lead, { name: "Asha", email: STUDENT.email }), DuplicateMemberError);
  } finally {
    db.close();
  }
});

test("join, leave and join-code routes: authentication, status codes and the cleared cookie", async () => {
  await withRouteDatabase(async () => {
    const lead = await loginCookie(DEMO.admin);
    getDatabase().createMemberWithCredentials({ name: "Student", email: STUDENT.email, password: STUDENT.password, role: "member", clubId: DEFAULT_CLUB_ID });
    const asha = await loginCookie(STUDENT.email, STUDENT.password);

    assert.equal((await joinRoute(apiRequest("/api/clubs/join", { body: { joinCode: "ANYTHING" } }))).status, 401);
    assert.equal((await joinCodeRoute(apiRequest("/api/clubs/join-code", { cookie: asha }))).status, 403);
    const rotated = await rotateCodeRoute(apiRequest("/api/clubs/join-code", { method: "POST", cookie: lead }));
    assert.equal(rotated.status, 200);
    const { joinCode } = await rotated.json();
    assert.equal((await joinCodeRoute(apiRequest("/api/clubs/join-code", { cookie: lead }))).status, 200);

    const duplicate = await joinRoute(apiRequest("/api/clubs/join", { cookie: asha, body: { joinCode } }));
    assert.equal(duplicate.status, 409, "already a member of the default club");
    assert.equal((await joinRoute(apiRequest("/api/clubs/join", { cookie: asha, body: { joinCode: "" } }))).status, 400);

    const left = await leaveRoute(apiRequest(`/api/clubs/${DEFAULT_CLUB_ID}/leave`, { method: "POST", cookie: asha }), routeParams({ id: DEFAULT_CLUB_ID }));
    assert.equal(left.status, 200);
    assert.deepEqual(await left.json(), { clubId: DEFAULT_CLUB_ID, activeClubId: null, signedOut: true });
    assert.match(left.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie: asha }))).status, 401);

    const disabled = await disableCodeRoute(apiRequest("/api/clubs/join-code", { method: "DELETE", cookie: lead }));
    assert.deepEqual(await disabled.json(), { clubId: DEFAULT_CLUB_ID, joinCode: null });
  });
});
