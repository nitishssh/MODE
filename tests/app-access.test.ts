import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionUser } from "../src/lib/contracts";
import { ROLE_PERMISSIONS } from "../src/lib/auth/permissions";
import { allowedSections, canAccess, homeFor, sectionFor } from "../src/app/app/_lib/access";

function user(role: SessionUser["role"]): SessionUser {
  return { id: `u-${role}`, name: role, email: `${role}@example.com`, role, clubId: "club-sample", permissions: [...ROLE_PERMISSIONS[role]] };
}

test("only the club lead sees every workspace section; each other role gets its own slice", () => {
  const all = ["overview", "members", "events", "door", "announcements", "shop", "tasks", "expenses", "treasury", "tickets", "pass", "notifications", "settings"];
  assert.deepEqual([...allowedSections(user("admin"))].sort(), [...all].sort());
  const everyone = ["announcements", "events", "expenses", "notifications", "overview", "pass", "settings", "shop", "tasks", "tickets"];
  assert.deepEqual([...allowedSections(user("member"))].sort(), everyone, "members get the club's public life and their own things");
  assert.deepEqual([...allowedSections(user("volunteer"))].sort(), [...everyone, "door"].sort(), "volunteers add the door");
  assert.deepEqual([...allowedSections(user("treasurer"))].sort(), [...everyone, "members", "treasury"].sort());
  assert.deepEqual([...allowedSections(user("organizer"))].sort(), [...everyone, "door", "members"].sort());
  for (const role of ["member", "volunteer", "treasurer", "organizer"] as const) assert.ok(allowedSections(user(role)).size < allowedSections(user("admin")).size, `${role} sees less than the lead`);
  assert.equal(canAccess(user("organizer"), "treasury"), false, "organizers have no ledger access");
  assert.equal(canAccess(user("organizer"), "door"), true);
  assert.equal(canAccess(user("treasurer"), "treasury"), true);
  assert.equal(canAccess(user("treasurer"), "door"), false);
  assert.equal(canAccess(user("treasurer"), "tasks"), true, "anyone can be assigned a task, so everyone sees the board");
  assert.equal(canAccess(user("volunteer"), "announcements"), true, "announcements are for everyone");
  assert.equal(canAccess(user("member"), "members"), false);
});

test("a role list can never grant a section its server permissions deny", () => {
  const demoted = { ...user("treasurer"), permissions: user("treasurer").permissions.filter((p) => p !== "ledger:read") };
  assert.equal(canAccess(demoted, "treasury"), false);
  const volunteerWithoutDoor = { ...user("volunteer"), permissions: [] };
  assert.equal(allowedSections(volunteerWithoutDoor).has("door"), false);
});

test("URLs map to sections and each role lands on the first section of its slice", () => {
  assert.equal(sectionFor("/app"), "overview");
  assert.equal(sectionFor("/app/door"), "door");
  assert.equal(sectionFor("/app/events/demo-event-1/door"), "door");
  assert.equal(sectionFor("/app/events/demo-event-1"), "events");
  assert.equal(sectionFor("/app/shop/manage"), "shop");
  assert.equal(sectionFor("/app/login"), null);
  assert.equal(homeFor(user("admin")), "/app");
  assert.equal(homeFor(user("volunteer")), "/app");
  assert.equal(homeFor(user("member")), "/app");
  assert.equal(homeFor({ ...user("volunteer"), permissions: [] }), "/app", "the overview is the home for every role");
});
