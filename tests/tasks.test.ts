import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as statusRoute } from "../src/app/api/tasks/[id]/status/route";
import { PATCH as updateRoute } from "../src/app/api/tasks/[id]/route";
import { GET as listRoute, POST as createRoute } from "../src/app/api/tasks/route";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

test("starter tasks migrate with owners resolved and the dashboard keeps its shape", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const tasks = db.tasks.list(organizer.clubId);
    assert.equal(tasks.length, 3);
    const asha = tasks.find((task) => task.assignee === "Asha Demo")!;
    assert.equal(asha.assigneeId, "demo-member-1", "seed owner resolved to a member id");
    const unassigned = tasks.find((task) => task.title.startsWith("Draft the fundraiser"))!;
    assert.equal(unassigned.assignee, "");
    assert.equal(unassigned.assigneeId, null);
    const done = tasks.find((task) => task.status === "done")!;
    assert.ok(done.completedAt);
    assert.equal(db.getDashboard().tasks.length, 3);
    assert.deepEqual(Object.keys(db.getDashboard().tasks[0]).sort(), ["assignee", "id", "status", "title"]);
  } finally {
    db.close();
  }
});

test("officers create and reassign tasks; invalid assignees and events are rejected", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const volunteer = actorFor(db, DEMO.volunteer);
    const treasurer = actorFor(db, DEMO.treasurer);
    const clubId = organizer.clubId;
    const event = db.events.createEvent(organizer, { title: "Bake sale", description: "", startsAt: "2026-10-30T09:00:00.000Z", venue: "Quad", capacity: 0, memberPricePaise: 0, guestPricePaise: 0, status: "published" });

    assert.throws(() => db.tasks.create(volunteer, { title: "Set up tables", description: "", assigneeId: null, eventId: null, dueAt: null, status: "todo" }), ForbiddenError);
    assert.throws(() => db.tasks.create(treasurer, { title: "Set up tables", description: "", assigneeId: null, eventId: null, dueAt: null, status: "todo" }), ForbiddenError);
    assert.throws(() => db.tasks.create(organizer, { title: "Set up tables", description: "", assigneeId: "not-a-member", eventId: null, dueAt: null, status: "todo" }), NotFoundError);
    assert.throws(() => db.tasks.create(organizer, { title: "Set up tables", description: "", assigneeId: null, eventId: "missing-event", dueAt: null, status: "todo" }), NotFoundError);
    assert.throws(() => db.tasks.create(organizer, { title: "ab", description: "", assigneeId: null, eventId: null, dueAt: "yesterday", status: "todo" }), ValidationError);

    const otherClub = db.createClub("Other club");
    const outsider = db.createMemberWithCredentials({ name: "Outsider", email: "outsider@example.com", password: "outsider-pass-1", role: "member", clubId: otherClub });
    assert.throws(() => db.tasks.create(organizer, { title: "Cross-club", description: "", assigneeId: outsider.id, eventId: null, dueAt: null, status: "todo" }), NotFoundError, "assignee must be in the same club");

    const task = db.tasks.create(organizer, { title: "Set up tables", description: "Six tables by 8am", assigneeId: volunteer.memberId, eventId: event.id, dueAt: "2026-10-30T02:30:00.000Z", status: "todo" });
    assert.deepEqual([task.assignee, task.assigneeId, task.eventId, task.eventTitle, task.dueAt, task.overdue], ["Volunteer Demo", volunteer.memberId, event.id, "Bake sale", "2026-10-30T02:30:00.000Z", false]);

    const reassigned = db.tasks.update(organizer, task.id, { assigneeId: treasurer.memberId, dueAt: null });
    assert.deepEqual([reassigned.assignee, reassigned.assigneeId, reassigned.dueAt], ["Treasurer Demo", treasurer.memberId, null]);
    const cleared = db.tasks.update(organizer, task.id, { assigneeId: null });
    assert.deepEqual([cleared.assignee, cleared.assigneeId], ["", null]);
    assert.throws(() => db.tasks.update(volunteer, task.id, { title: "Hijack" }), ForbiddenError);
    assert.equal(db.tasks.list(clubId, { eventId: event.id }).length, 1);
    assert.equal(db.listAudit(actorFor(db, DEMO.admin), "task")[0].action, "task.updated");
  } finally {
    db.close();
  }
});

test("status transitions are limited to the assignee or officers, and overdue is computed from the clock", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const volunteer = actorFor(db, DEMO.volunteer);
    const clubId = organizer.clubId;
    db.createMemberWithCredentials({ name: "Other Volunteer", email: "other-vol@example.com", password: "other-pass-123", role: "volunteer" });
    const bystander = actorFor(db, "other-vol@example.com", "other-pass-123");

    const task = db.tasks.create(organizer, { title: "Collect donations", description: "", assigneeId: volunteer.memberId, eventId: null, dueAt: "2026-10-12T12:00:00.000Z", status: "todo" });
    assert.throws(() => db.tasks.setStatus(bystander, task.id, "in_progress"), ForbiddenError);
    const started = db.tasks.setStatus(volunteer, task.id, "in_progress");
    assert.equal(started.status, "in_progress");
    assert.equal(db.tasks.setStatus(volunteer, task.id, "in_progress").status, "in_progress", "idempotent");

    assert.equal(db.tasks.list(clubId, { overdue: "true" }).length, 0);
    clock.now = new Date("2026-10-13T00:00:00.000Z");
    const overdue = db.tasks.list(clubId, { overdue: "true" });
    assert.deepEqual(overdue.map((item) => item.id), [task.id]);
    assert.equal(db.tasks.requireTask(clubId, task.id).overdue, true);
    assert.deepEqual(db.tasks.mine(volunteer).map((item) => item.id), [task.id]);

    const finished = db.tasks.setStatus(volunteer, task.id, "done");
    assert.equal(finished.completedAt, "2026-10-13T00:00:00.000Z");
    assert.equal(finished.overdue, false, "done tasks are never overdue");
    assert.equal(db.tasks.list(clubId, { overdue: "true" }).length, 0);
    const reopened = db.tasks.setStatus(organizer, task.id, "todo");
    assert.equal(reopened.completedAt, null);
    assert.deepEqual(db.listAudit(actorFor(db, DEMO.admin), "task").filter((entry) => entry.action === "task.status_changed").length, 3);
  } finally {
    db.close();
  }
});

test("task routes enforce 401/403, validate assignees and support overdue and mine queries", async () => {
  await withRouteDatabase(async () => {
    const organizer = await loginCookie(DEMO.organizer);
    const volunteer = await loginCookie(DEMO.volunteer);
    const { GET: me } = await import("../src/app/api/auth/me/route");
    const volunteerId = (await (await me(apiRequest("/api/auth/me", { cookie: volunteer }))).json()).user.id as string;

    assert.equal((await listRoute(apiRequest("/api/tasks"))).status, 401);
    assert.equal((await createRoute(apiRequest("/api/tasks", { body: { title: "Hang posters" }, cookie: volunteer }))).status, 403);
    assert.equal((await createRoute(apiRequest("/api/tasks", { body: { title: "Hang posters", assigneeId: "ghost" }, cookie: organizer }))).status, 404);
    assert.equal((await createRoute(apiRequest("/api/tasks", { body: { title: "Hang posters", dueAt: "not-a-date" }, cookie: organizer }))).status, 400);
    const created = await createRoute(apiRequest("/api/tasks", { body: { title: "Hang posters", assigneeId: volunteerId, dueAt: "2026-10-09T10:00:00.000Z" }, cookie: organizer }));
    assert.equal(created.status, 201);
    const task = (await created.json()).task;
    assert.equal(task.overdue, true, "due date already passed on the frozen demo clock");

    const overdue = await (await listRoute(apiRequest("/api/tasks?overdue=true", { cookie: volunteer }))).json();
    assert.deepEqual(overdue.tasks.map((item: { id: string }) => item.id), [task.id]);
    const mine = await (await listRoute(apiRequest("/api/tasks?mine=true", { cookie: volunteer }))).json();
    assert.equal(mine.tasks.length, 1);
    assert.equal((await listRoute(apiRequest("/api/tasks?status=bogus", { cookie: volunteer }))).status, 400);

    assert.equal((await statusRoute(apiRequest(`/api/tasks/${task.id}/status`, { body: { status: "done" }, cookie: await loginCookie(DEMO.treasurer) }), routeParams({ id: task.id }))).status, 403);
    assert.equal((await statusRoute(apiRequest(`/api/tasks/${task.id}/status`, { body: { status: "blocked" }, cookie: volunteer }), routeParams({ id: task.id }))).status, 400);
    const done = await statusRoute(apiRequest(`/api/tasks/${task.id}/status`, { body: { status: "done" }, cookie: volunteer }), routeParams({ id: task.id }));
    assert.equal(done.status, 200);
    assert.equal((await done.json()).task.status, "done");
    assert.equal((await updateRoute(apiRequest(`/api/tasks/${task.id}`, { method: "PATCH", body: { title: "Hang more posters" }, cookie: volunteer }), routeParams({ id: task.id }))).status, 403);
    assert.equal((await updateRoute(apiRequest(`/api/tasks/${task.id}`, { method: "PATCH", body: { title: "Hang more posters" }, cookie: organizer }), routeParams({ id: task.id }))).status, 200);
  });
});
