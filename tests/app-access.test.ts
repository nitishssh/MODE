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
  const personal = ["notifications", "pass", "settings"];
  assert.deepEqual([...allowedSections(user("member"))].sort(), [...personal, "announcements", "events", "shop", "tickets"].sort());
  assert.deepEqual([...allowedSections(user("volunteer"))].sort(), [...personal, "announcements", "door", "expenses", "tasks"].sort());
  assert.deepEqual([...allowedSections(user("treasurer"))].sort(), [...personal, "announcements", "events", "expenses", "members", "overview", "shop", "treasury"].sort());
  assert.deepEqual([...allowedSections(user("organizer"))].sort(), [...all.filter((s) => s !== "treasury")].sort());
  const sizes = (["volunteer", "treasurer", "organizer", "admin"] as const).map((role) => allowedSections(user(role)).size);
  assert.ok(sizes.every((size, i) => i === 0 || size > sizes[i - 1]), `volunteer < treasurer < organizer < admin: ${sizes.join(" < ")}`);
  assert.ok(allowedSections(user("member")).size <= allowedSections(user("volunteer")).size, "members never see more than volunteers");
  assert.equal(canAccess(user("organizer"), "treasury"), false, "organizers have no ledger access");
  assert.equal(canAccess(user("organizer"), "door"), true);
  assert.equal(canAccess(user("treasurer"), "treasury"), true);
  assert.equal(canAccess(user("treasurer"), "door"), false);
  assert.equal(canAccess(user("treasurer"), "tasks"), false);
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
  assert.equal(homeFor(user("volunteer")), "/app/door");
  assert.equal(homeFor(user("member")), "/app/events");
  assert.equal(homeFor(user("treasurer")), "/app");
  assert.equal(homeFor({ ...user("volunteer"), permissions: [] }), "/app/tasks", "without the door permission a volunteer lands on tasks");
});
