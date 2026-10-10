import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as me } from "../src/app/api/auth/me/route";
import { POST as register } from "../src/app/api/auth/register/route";
import { GET as dashboard } from "../src/app/api/dashboard/route";
import { POST as createMember } from "../src/app/api/members/route";
import { PATCH as changeRole } from "../src/app/api/members/[id]/role/route";
import { ROLES, hasPermission } from "../src/lib/auth/permissions";
import { SESSION_TTL_MS } from "../src/lib/auth/session";
import { optionalActor, requireActor } from "../src/lib/auth/authorize";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../src/lib/errors";
import { demoPassword } from "../src/lib/db/migrations";
import { DEMO, actorFor, apiRequest, cookieFrom, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

test("role matrix: only admin manages roles, only officers see members, finance is treasurer/admin", () => {
  assert.deepEqual(ROLES.filter((role) => hasPermission(role, "roles:manage")), ["admin"]);
  assert.deepEqual(ROLES.filter((role) => hasPermission(role, "members:read")), ["organizer", "treasurer", "admin"]);
  assert.deepEqual(ROLES.filter((role) => hasPermission(role, "ledger:read")), ["treasurer", "admin"]);
  assert.deepEqual(ROLES.filter((role) => hasPermission(role, "tickets:check_in")), ["volunteer", "organizer", "admin"]);
  for (const role of ROLES) assert.ok(hasPermission(role, "bookings:create"));
});

test("register, login, session lookup and logout work through the HTTP routes", async () => {
  await withRouteDatabase(async () => {
    const body = { name: "New Student", email: "new@example.com", password: "correct horse battery" };
    const weak = await register(apiRequest("/api/auth/register", { body: { ...body, password: "short" } }));
    assert.equal(weak.status, 400);
    assert.equal((await weak.json()).details[0].field, "password");

    const created = await register(apiRequest("/api/auth/register", { body }));
    assert.equal(created.status, 201);
    const auth = await created.json();
    assert.equal(auth.user.role, "member");
    assert.ok(!("password" in auth.user) && !("passwordHash" in auth.user));
    const cookie = cookieFrom(created);
    assert.match(created.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax/);

    assert.equal((await register(apiRequest("/api/auth/register", { body }))).status, 409);
    assert.equal((await me(apiRequest("/api/auth/me"))).status, 401);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie: "mode_session=forged" }))).status, 401);
    const who = await me(apiRequest("/api/auth/me", { cookie }));
    assert.equal(who.status, 200);
    assert.equal((await who.json()).user.email, "new@example.com");

    const wrong = await login(apiRequest("/api/auth/login", { body: { email: body.email, password: "wrong password" } }));
    assert.equal(wrong.status, 401);
    const unknown = await login(apiRequest("/api/auth/login", { body: { email: "nobody@example.com", password: "wrong password" } }));
    assert.equal(unknown.status, 401);
    assert.equal((await wrong.json()).error, (await unknown.json()).error);

    const crossSite = await login(apiRequest("/api/auth/login", { body: { email: body.email, password: body.password }, origin: "https://evil.example" }));
    assert.equal(crossSite.status, 403);

    const out = await logout(apiRequest("/api/auth/logout", { method: "POST", cookie }));
    assert.equal(out.status, 200);
    assert.match(out.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie }))).status, 401);
  });
});

test("sessions expire after their TTL and revoked sessions stop working", () => {
  const { db, clock } = memoryDatabase();
  try {
    const issued = db.login({ email: DEMO.organizer, password: demoPassword() });
    assert.ok(db.getActor(issued.token));
    clock.now = new Date(clock.now.getTime() + SESSION_TTL_MS - 1000);
    assert.ok(db.getActor(issued.token), "still valid just before expiry");
    clock.now = new Date(clock.now.getTime() + 2000);
    assert.equal(db.getActor(issued.token), null, "expired");

    clock.now = new Date("2026-10-10T08:00:00.000Z");
    const second = db.login({ email: DEMO.organizer, password: demoPassword() });
    db.logout(second.token);
    assert.equal(db.getActor(second.token), null, "revoked");
    assert.equal(db.getActor(null), null);
    assert.equal(db.getActor(""), null);
  } finally {
    db.close();
  }
});

test("role changes are admin-only, audited, scoped to the club and never self-applied", () => {
  const { db } = memoryDatabase();
  try {
    const admin = actorFor(db, DEMO.admin);
    const organizer = actorFor(db, DEMO.organizer);
    const target = db.getMembers().find((member) => member.email === DEMO.member)!;

    assert.throws(() => db.setRole(organizer, target.id, "treasurer"), ForbiddenError);
    assert.throws(() => db.setRole(admin, admin.memberId, "member"), ConflictError);
    assert.throws(() => db.setRole(admin, "missing-id", "treasurer"), NotFoundError);

    const updated = db.setRole(admin, target.id, "treasurer");
    assert.equal(updated.role, "treasurer");
    const audit = db.listAudit(admin, "member");
    assert.equal(audit[0].action, "member.role_changed");
    assert.deepEqual(audit[0].details, { from: "member", to: "treasurer" });

    // The promoted member must log in to receive the new role in a session.
    db.setPassword(admin, target.id, "treasurer-pass-123");
    const promoted = actorFor(db, DEMO.member, "treasurer-pass-123");
    assert.equal(promoted.role, "treasurer");
    assert.ok(db.getDashboard(promoted).access.finance);

    // Club isolation: an admin of another club cannot see or manage this club's members.
    const otherClub = db.createClub("Other Club");
    db.createMemberWithCredentials({ name: "Other Lead", email: "other-lead@example.com", password: "other-pass-123", role: "admin", clubId: otherClub });
    const otherAdmin = actorFor(db, "other-lead@example.com", "other-pass-123");
    assert.equal(otherAdmin.clubId, otherClub);
    assert.equal(db.getMembers(otherClub).length, 1);
    assert.throws(() => db.setRole(otherAdmin, target.id, "member"), NotFoundError);
    assert.equal(db.getDashboard(otherAdmin).members.length, 1);
    assert.equal(db.getMembers().length, 9, "default club unchanged");
  } finally {
    db.close();
  }
});

test("role route and dashboard enforce 401/403 and hide personal and finance data", async () => {
  await withRouteDatabase(async () => {
    const anonymous = await dashboard(apiRequest("/api/dashboard"));
    assert.equal(anonymous.status, 200);
    const publicView = await anonymous.json();
    assert.deepEqual(publicView.members, []);
    assert.deepEqual(publicView.transactions, []);
    assert.deepEqual(publicView.access, { members: false, finance: false });
    assert.ok(publicView.events.length > 0, "public programme stays visible");

    const treasurer = await loginCookie(DEMO.treasurer);
    const finance = await (await dashboard(apiRequest("/api/dashboard", { cookie: treasurer }))).json();
    assert.equal(finance.access.finance, true);
    assert.equal(finance.metrics.balancePaise, 185000);
    assert.equal(finance.transactions.length, 3);

    const organizer = await loginCookie(DEMO.organizer);
    const ops = await (await dashboard(apiRequest("/api/dashboard", { cookie: organizer }))).json();
    assert.deepEqual(ops.access, { members: true, finance: false });
    assert.ok(ops.members.length >= 7);

    const target = ops.members.find((member: { email: string }) => member.email === DEMO.member);
    const params = routeParams({ id: target.id });
    assert.equal((await changeRole(apiRequest(`/api/members/${target.id}/role`, { method: "PATCH", body: { role: "organizer" } }), params)).status, 401);
    assert.equal((await changeRole(apiRequest(`/api/members/${target.id}/role`, { method: "PATCH", body: { role: "organizer" }, cookie: organizer }), params)).status, 403);
    const admin = await loginCookie(DEMO.admin);
    assert.equal((await changeRole(apiRequest(`/api/members/${target.id}/role`, { method: "PATCH", body: { role: "president" }, cookie: admin }), params)).status, 400);
    const changed = await changeRole(apiRequest(`/api/members/${target.id}/role`, { method: "PATCH", body: { role: "organizer" }, cookie: admin }), params);
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).member.role, "organizer");
  });
});

test("unauthenticated and forbidden errors map to 401 and 403 consistently", () => {
  assert.equal(new UnauthorizedError().status, 401);
  assert.equal(new ForbiddenError().status, 403);
});

test("native login returns the same session as the cookie and bearer writes still enforce roles", async () => {
  await withRouteDatabase(async () => {
    const response = await login(apiRequest("/api/auth/login", {
      origin: null,
      body: { email: DEMO.organizer, password: demoPassword() },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { token } = await response.json();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const cookie = cookieFrom(response);
    assert.equal(cookie, `mode_session=${token}`);
    const authorization = `Bearer ${token}`;
    const native = await me(apiRequest("/api/auth/me", { authorization, origin: null }));
    assert.equal(native.status, 200);
    assert.equal((await native.json()).user.email, DEMO.organizer);

    const payload = { name: "Native Student", email: "native@example.com" };
    assert.equal((await createMember(apiRequest("/api/members", {
      body: payload, cookie, origin: "https://other.example",
    }))).status, 403);
    const bearerWrite = apiRequest("/api/members", {
      body: payload, authorization, origin: "https://other.example",
    });
    bearerWrite.headers.set("sec-fetch-site", "cross-site");
    assert.equal((await createMember(bearerWrite)).status, 201);

    const volunteer = await login(apiRequest("/api/auth/login", {
      body: { email: DEMO.volunteer, password: demoPassword() },
    }));
    const volunteerToken = (await volunteer.json()).token;
    const selected = await me(apiRequest("/api/auth/me", { cookie, authorization: `bearer ${volunteerToken}` }));
    assert.equal((await selected.json()).user.email, DEMO.volunteer, "bearer selects the identity even with another cookie");
    assert.equal((await createMember(apiRequest("/api/members", {
      body: { name: "Denied Student", email: "denied@example.com" }, cookie,
      authorization: `Bearer ${volunteerToken}`, origin: "https://other.example",
    }))).status, 403, "organizer cookie must not grant volunteer permission");

    const logoutResponse = await logout(apiRequest("/api/auth/logout", {
      method: "POST", authorization, cookie: cookieFrom(volunteer), origin: "https://other.example",
    }));
    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutResponse.headers.get("set-cookie"), null, "bearer logout must not clear an unrelated browser session");
    assert.equal((await me(apiRequest("/api/auth/me", { authorization }))).status, 401);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie }))).status, 401, "logout revokes both transports for that session");
    assert.equal((await me(apiRequest("/api/auth/me", { cookie: cookieFrom(volunteer) }))).status, 200, "unselected session is not revoked");
  });
});

test("invalid Authorization never falls back to cookies on protected, public or logout routes", async () => {
  await withRouteDatabase(async () => {
    const cookie = await loginCookie(DEMO.organizer);
    for (const authorization of ["", "Basic abc", "Bearer", "Bearer bad", `Bearer ${"a".repeat(43)}`, `Bearer ${"a".repeat(43)}, Bearer ${"b".repeat(43)}`]) {
      const options = { cookie, authorization, origin: "https://other.example" };
      assert.equal((await me(apiRequest("/api/auth/me", options))).status, 401, authorization);
      assert.equal((await dashboard(apiRequest("/api/dashboard", options))).status, 401, authorization);
      assert.equal((await createMember(apiRequest("/api/members", {
        ...options, body: { name: "Denied Student", email: "denied@example.com" },
      }))).status, 401, authorization);
      assert.equal((await logout(apiRequest("/api/auth/logout", { ...options, method: "POST" }))).status, 401, authorization);
    }
    assert.equal((await me(apiRequest("/api/auth/me", { cookie }))).status, 200);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie: "mode_session=%ZZ" }))).status, 401);
    assert.equal((await dashboard(apiRequest("/api/dashboard", { cookie: "mode_session=%ZZ" }))).status, 200);
  });
});

test("expired and revoked bearer sessions cannot use a still-valid cookie", () => {
  const { db, clock } = memoryDatabase();
  try {
    const expired = db.login({ email: DEMO.organizer, password: demoPassword() });
    clock.now = new Date(clock.now.getTime() + SESSION_TTL_MS);
    const current = db.login({ email: DEMO.organizer, password: demoPassword() });
    const revoked = db.login({ email: DEMO.organizer, password: demoPassword() });
    db.logout(revoked.token);
    for (const token of [expired.token, revoked.token]) {
      const request = apiRequest("/api/dashboard", { cookie: `mode_session=${current.token}`, authorization: `Bearer ${token}` });
      assert.throws(() => optionalActor(request, db), UnauthorizedError);
      assert.throws(() => requireActor(request, db, { mutation: true }), UnauthorizedError);
    }
    assert.ok(db.getActor(current.token));
  } finally { db.close(); }
});
