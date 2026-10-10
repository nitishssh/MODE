import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as deliveryRoute } from "../src/app/api/announcements/[id]/delivery/route";
import { POST as publishRoute } from "../src/app/api/announcements/[id]/publish/route";
import { GET as listRoute, POST as draftRoute } from "../src/app/api/announcements/route";
import { POST as dispatchRoute } from "../src/app/api/outbox/dispatch/route";
import { PLAN_ANNUAL_ID } from "../src/lib/db/migrations";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import { DEMO, actorFor, apiRequest, loginCookie, memoryDatabase, routeParams, withRouteDatabase } from "./helpers";

test("drafts are private, publication is dated, and delivery is queued once per eligible member", () => {
  const { db, clock } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const member = actorFor(db, DEMO.volunteer);
    const clubId = organizer.clubId;
    assert.throws(() => db.announcements.createDraft(member, { title: "Nope", body: "x", audience: "all" }), ForbiddenError);
    assert.throws(() => db.announcements.createDraft(organizer, { title: "ab", body: "", audience: "all" }), ValidationError);

    const draft = db.announcements.createDraft(organizer, { title: "Fundraiser this Friday", body: "Bring friends.", audience: "all" });
    assert.equal(draft.status, "draft");
    assert.equal(draft.publishedAt, null);
    assert.ok(!db.announcements.listPublished(clubId).some((item) => item.id === draft.id), "draft hidden from the public archive");
    assert.ok(db.announcements.listAll(organizer).some((item) => item.id === draft.id));
    assert.throws(() => db.announcements.listAll(member), ForbiddenError);

    const edited = db.announcements.updateDraft(organizer, draft.id, { body: "Bring friends and family." });
    assert.equal(edited.body, "Bring friends and family.");

    clock.now = new Date("2026-10-11T04:30:00.000Z");
    const published = db.announcements.publish(organizer, draft.id);
    assert.equal(published.firstPublish, true);
    assert.equal(published.announcement.status, "published");
    assert.equal(published.announcement.publishedAt, "2026-10-11T04:30:00.000Z");
    const expectedRecipients = db.getMembers(clubId).length;
    assert.equal(published.queued, expectedRecipients);
    assert.equal(published.delivery.recipients, expectedRecipients);
    assert.equal(published.delivery.byStatus.pending, expectedRecipients);
    assert.ok(!JSON.stringify(published).includes("@example.com"), "no recipient addresses in the publish response");

    const archive = db.announcements.listPublished(clubId);
    assert.equal(archive[0].id, draft.id, "newest first");
    assert.equal(archive[0].publishedAt, "2026-10-11T04:30:00.000Z");
    assert.throws(() => db.announcements.updateDraft(organizer, draft.id, { title: "Changed" }), (error: unknown) => error instanceof ConflictError && error.code === "announcement_published");

    clock.now = new Date("2026-10-11T05:00:00.000Z");
    const again = db.announcements.publish(organizer, draft.id);
    assert.equal(again.firstPublish, false);
    assert.equal(again.queued, 0, "repeat publish queues nothing");
    assert.equal(again.alreadyQueued, expectedRecipients);
    assert.equal(again.announcement.publishedAt, "2026-10-11T04:30:00.000Z", "original publication date kept");
    assert.equal(db.outbox.list(organizer, { kind: "announcement" }).length, expectedRecipients);

    const dispatched = db.outbox.dispatch(organizer);
    assert.equal(dispatched.transport, "preview");
    const after = db.announcements.deliverySummary(organizer, draft.id);
    assert.equal(after.byStatus.previewed, expectedRecipients);
    assert.equal(after.byStatus.sent, 0, "preview delivery is never reported as sent");
    assert.equal(db.outbox.dispatch(organizer).previewed, 0, "retry does not resend previewed messages");

    // A member who joins after publication is not retro-notified unless republished.
    db.createMember({ name: "Late Joiner", email: "late@example.com" });
    const republished = db.announcements.publish(organizer, draft.id);
    assert.equal(republished.queued, 1);
    assert.throws(() => db.announcements.publish(organizer, "missing"), NotFoundError);
  } finally {
    db.close();
  }
});

test("audience 'active' targets only members with a current membership", () => {
  const { db } = memoryDatabase();
  try {
    const organizer = actorFor(db, DEMO.organizer);
    const clubId = organizer.clubId;
    const active = db.getMembers(clubId).filter((member) => db.membership.statusFor(clubId, member.id).active);
    assert.equal(active.length, 2, "two seeded paid members");
    const fresh = db.createMember({ name: "Just Paid", email: "justpaid@example.com" });
    db.membership.recordDues(organizer, { memberId: fresh.id, planId: PLAN_ANNUAL_ID, paymentReference: "A-1", amountPaise: 50000 });

    const draft = db.announcements.createDraft(organizer, { title: "Members-only social", body: "Paid members welcome.", audience: "active" });
    assert.equal(db.announcements.updateDraft(organizer, draft.id, { title: "Members-only social!" }).audience, "active", "omitted audience is preserved");
    const published = db.announcements.publish(organizer, draft.id);
    assert.equal(published.queued, 3);
    assert.deepEqual(db.announcements.eligibleRecipients(clubId, "active").map((r) => r.id).sort(), [...active.map((m) => m.id), fresh.id].sort());
  } finally {
    db.close();
  }
});

test("announcement routes: public archive, officer-only drafting, idempotent publish and masked delivery", async () => {
  await withRouteDatabase(async () => {
    const publicList = await listRoute(apiRequest("/api/announcements"));
    assert.equal(publicList.status, 200);
    const before = (await publicList.json()).announcements.length;
    assert.equal(before, 1, "seeded announcement is published");

    const body = { title: "Route announcement", body: "Hello club" };
    assert.equal((await draftRoute(apiRequest("/api/announcements", { body }))).status, 401);
    assert.equal((await draftRoute(apiRequest("/api/announcements", { body, cookie: await loginCookie(DEMO.treasurer) }))).status, 403);
    const organizer = await loginCookie(DEMO.organizer);
    const created = await draftRoute(apiRequest("/api/announcements", { body, cookie: organizer }));
    assert.equal(created.status, 201);
    const id = (await created.json()).announcement.id as string;
    assert.equal((await (await listRoute(apiRequest("/api/announcements"))).json()).announcements.length, before, "draft not public");
    assert.equal((await (await listRoute(apiRequest("/api/announcements?scope=all", { cookie: organizer }))).json()).announcements.length, before + 1);

    const first = await publishRoute(apiRequest(`/api/announcements/${id}/publish`, { method: "POST", cookie: organizer }), routeParams({ id }));
    assert.equal(first.status, 201);
    const second = await publishRoute(apiRequest(`/api/announcements/${id}/publish`, { method: "POST", cookie: organizer }), routeParams({ id }));
    assert.equal(second.status, 200);
    assert.equal((await second.json()).queued, 0);
    assert.equal((await (await listRoute(apiRequest("/api/announcements"))).json()).announcements.length, before + 1);

    const delivery = await deliveryRoute(apiRequest(`/api/announcements/${id}/delivery`, { cookie: organizer }), routeParams({ id }));
    assert.equal(delivery.status, 200);
    const summary = (await delivery.json()).delivery;
    assert.equal(summary.transport, "preview");
    assert.ok(summary.recipients >= 7);
    assert.ok(!("messages" in summary) && !JSON.stringify(summary).includes("@"));
    assert.equal((await deliveryRoute(apiRequest(`/api/announcements/${id}/delivery`), routeParams({ id }))).status, 401);
    assert.equal((await dispatchRoute(apiRequest("/api/outbox/dispatch", { method: "POST", cookie: organizer }))).status, 200);
  });
});
