import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { listHref, readListQuery } from "../src/lib/list-query";
import { PageLoader, readCursorPage } from "../src/lib/page-loader";
import { authHref, pageHref, safeReturnTarget } from "../src/lib/return-target";
import { preserveTabQueryHistory } from "../src/lib/tab-query-history";
import { createListActions, type ListNavigationError } from "../src/lib/list-actions";
import { SessionClient } from "../src/lib/session-client";
import type { SessionUser } from "../src/generated/contracts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const page = (id: string) => ({ items: [{ id }], hasMore: false, nextCursor: null });

test("same-login revalidation retains the page owner while login, token and permissions replace it", async () => {
  const user: SessionUser = { id: "member-1", clubId: "club-1", name: "Member", email: "member@example.com", role: "treasurer", permissions: ["expenses:review", "ledger:read"] };
  let activeUser = user;
  let token = "a".repeat(43);
  const client = new SessionClient({ platform: "native", baseUrl: "http://localhost:3000", store: {
    async read() { return token; }, async write(value) { token = value; }, async clear() { token = ""; },
  }, fetch: async () => new Response(JSON.stringify({ user: activeUser, token })) });
  await client.bootstrap();
  const owner = client.snapshot().user;
  const loader = new PageLoader(async () => page("claim-with-draft"), 25, null, () => client.snapshot().user === owner);
  await loader.load();
  const loaded = loader.snapshot().data;
  activeUser = { ...user, permissions: [...user.permissions].reverse() };
  await client.bootstrap();
  assert.equal(client.snapshot().user, owner, "same-login resume must not invalidate the hook's loader memo");
  assert.equal(loader.snapshot().data, loaded);
  activeUser = { ...user, permissions: ["ledger:read"] };
  await client.bootstrap();
  assert.notEqual(client.snapshot().user, owner, "permission changes invalidate the page owner");
  const changedPermissions = client.snapshot().user;
  activeUser = { ...activeUser, role: "admin" };
  await client.bootstrap();
  assert.notEqual(client.snapshot().user, changedPermissions);
  const changedRole = client.snapshot().user;
  await client.signIn(user.email, "another-login");
  assert.notEqual(client.snapshot().user, changedRole, "same-user re-login still gets a new owner");
  const newLogin = client.snapshot().user;
  token = "b".repeat(43);
  await client.bootstrap();
  assert.notEqual(client.snapshot().user, newLogin, "native credential replacement still invalidates pages");
});

test("reset, restart and retry clear local navigation errors even for the same query key", async () => {
  const parameters = readListQuery("tasks", {}).parameters;
  const key = readListQuery("tasks", parameters).key;
  const state: { error: ListNavigationError; loads: number; resets: number } = { error: null, loads: 0, resets: 0 };
  const actions = createListActions({
    kind: "tasks", parameters, key,
    push: href => assert.equal(readListQuery("tasks", href.params).key, key),
    setError: error => { state.error = error; }, resetDraft: () => { state.resets++; },
    load: async () => { state.loads++; },
  });
  actions.updateFilters({ q: "C:\\club" }); assert.ok(state.error);
  actions.clearFilters(); assert.equal(state.error, null); assert.equal(state.resets, 1);
  actions.updateFilters({ q: "C:\\club" }); assert.ok(state.error);
  actions.restart(); assert.equal(state.error, null);
  actions.updateFilters({ q: "C:\\club" }); assert.ok(state.error);
  await actions.reload(); assert.equal(state.error, null); assert.equal(state.loads, 1);
  actions.updateFilters({ q: "C:\\club" }); assert.ok(state.error);
  actions.updateFilters({ q: null }); assert.equal(state.error, null);
  const invalid = readListQuery("tasks", { mine: "true", assigneeId: "member-1" });
  const stillInvalid = createListActions({
    kind: "tasks", parameters: invalid.parameters, key: invalid.key,
    push: () => assert.fail("A conflicting query must not navigate"), setError: error => { state.error = error; },
    resetDraft() {}, async load() {},
  });
  stillInvalid.restart(); assert.ok(state.error, "failed recovery still explains the invalid query");
  await stillInvalid.reload();
  assert.ok(invalid.error, "retry cannot hide the URL validation error displayed by the hook");
});

test("all bounded lists use v2 with default 25 rows and one fixed sort", () => {
  assert.equal(readListQuery("tasks", {}).path, "/api/v2/tasks?limit=25&sort=createdAt_desc");
  assert.equal(readListQuery("expenses", {}).path, "/api/v2/expenses?limit=25&sort=submittedAt_desc");
  assert.equal(readListQuery("ledger", {}).path, "/api/v2/ledger/entries?limit=25&sort=occurredAt_desc");
  assert.equal(readListQuery("tasks", { limit: "100" }).limit, 100);
  for (const input of [
    { limit: "101" }, { limit: "0" }, { limit: "2.5" }, { limit: "025" },
    { limit: ["25", "50"] }, { status: "unknown" }, { status: ["todo", "done"] },
    { token: "private" }, { cursor: "bad/cursor" }, { cursor: "" },
    { sort: "oldest" }, { mine: "true", assigneeId: "member-1" },
    { q: "   " }, { q: "x".repeat(201) },
  ]) {
    const query = readListQuery("tasks", input);
    assert.equal(query.path, null, JSON.stringify(input));
    assert.ok(query.error, JSON.stringify(input));
  }
  assert.equal(readListQuery("expenses", { mine: "true" }).path, null);
  assert.equal(readListQuery("ledger", { status: "approved" }).path, null);
});

test("filters reset cursor, paging preserves filters, and URL state survives auth", () => {
  const filters = { q: "Music & arts + ₹", status: "in_progress", eventId: "demo-event-1", mine: "true", overdue: "true", limit: "50", cursor: "body.signature" };
  const changed = listHref("tasks", filters, { status: "done" });
  assert.equal(changed.params.cursor, undefined);
  assert.equal(changed.params.q, filters.q);
  assert.equal(changed.params.limit, "50");
  const next = listHref("tasks", changed.params, { cursor: "next_body.signature" }, true);
  assert.equal(next.params.cursor, "next_body.signature");
  assert.equal(next.params.status, "done");
  const url = `${next.pathname}?${new URLSearchParams(next.params)}`;
  assert.equal(safeReturnTarget(url), url);
  assert.deepEqual(pageHref(authHref("/login", url).params.returnTo!), next);
  const restarted = listHref("tasks", next.params, { cursor: null }, true);
  assert.deepEqual(restarted, changed);
  const search = listHref("tasks", next.params, { q: "  different search  " });
  assert.equal(search.params.q, "different search");
  assert.equal(search.params.cursor, undefined);
  assert.equal(listHref("tasks", { assigneeId: "member-1", cursor: "a.b" }, { mine: "true" }).params.assigneeId, undefined);
  assert.equal(listHref("tasks", filters, { limit: "100" }).params.cursor, undefined);
  assert.throws(() => listHref("tasks", {}, { limit: "1000" }));
  assert.equal(listHref("tasks", { cursor: "invalid/cursor", status: "done" }, { cursor: null }, true).params.status, "done");
});

test("page responses cannot exceed the limit, repeat rows or loop cursors", () => {
  assert.deepEqual(readCursorPage(page("one"), 25, null), page("one"));
  assert.deepEqual(readCursorPage({ items: [], nextCursor: null, hasMore: false }, 25, null).items, []);
  for (const value of [
    null, [], { items: [], hasMore: false },
    { items: Array.from({ length: 26 }, (_, index) => ({ id: String(index) })), nextCursor: null, hasMore: false },
    { items: [{ id: "one" }, { id: "one" }], nextCursor: null, hasMore: false },
    { items: [null], nextCursor: null, hasMore: false },
    { items: [{ id: "one" }], nextCursor: null, hasMore: true },
    { items: [], nextCursor: "a.b", hasMore: true },
    { items: [{ id: "one" }], nextCursor: "current.cursor", hasMore: true },
  ]) assert.throws(() => readCursorPage(value, 25, "current.cursor"));
});

test("a slower refresh cannot overwrite the newest successful page", async () => {
  const first = deferred<unknown>(), second = deferred<unknown>();
  let call = 0;
  const loader = new PageLoader(() => (++call === 1 ? first.promise : second.promise), 25, null, () => true);
  const oldRequest = loader.load();
  const newRequest = loader.load();
  second.resolve(page("latest")); await newRequest;
  first.resolve(page("older")); await oldRequest;
  assert.equal(loader.snapshot().data?.items[0].id, "latest");
  assert.equal(loader.snapshot().loading, false);
  assert.equal(loader.snapshot().error, null);
});

test("failed requests expose a retry and do not erase a previously loaded page", async () => {
  let failure = false;
  const loader = new PageLoader(async () => { if (failure) throw new Error("Offline"); return page("saved"); }, 25, null, () => true);
  await loader.load();
  failure = true; await loader.load();
  assert.equal(loader.snapshot().error, "Offline");
  assert.equal(loader.snapshot().data?.items[0].id, "saved");
  assert.equal(loader.snapshot().loading, false);
  failure = false; await loader.load();
  assert.equal(loader.snapshot().error, null);
  assert.ok(loader.snapshot().time instanceof Date);
});

test("filter changes and replacement sessions cannot publish an older actor's rows", async () => {
  const response = deferred<unknown>();
  let actor = "member-a";
  const previous = new PageLoader(() => response.promise, 25, null, () => actor === "member-a");
  const request = previous.load();
  actor = "member-b";
  const replacement = new PageLoader(async () => page("member-b-only"), 25, null, () => actor === "member-b");
  assert.equal(replacement.snapshot().data, null);
  await replacement.load();
  response.resolve(page("private-member-a")); await request;
  assert.equal(previous.snapshot().data, null);
  assert.equal(replacement.snapshot().data?.items[0].id, "member-b-only");

  const pending = deferred<unknown>();
  const changedFilter = new PageLoader(() => pending.promise, 25, null, () => true);
  const stale = changedFilter.load(); changedFilter.dispose();
  pending.resolve(page("wrong-filter")); await stale;
  assert.equal(changedFilter.snapshot().data, null);
});

test("invalid page responses become a recoverable error", async () => {
  const loader = new PageLoader(async () => ({ items: [], nextCursor: "a.b", hasMore: true }), 25, null, () => true);
  await loader.load();
  assert.match(loader.snapshot().error!, /invalid page/);
  assert.equal(loader.snapshot().data, null);
  assert.equal(loader.snapshot().loading, false);
});

test("installed tab router keeps query snapshots for Back with the app adapter", () => {
  // This exercises actual navigator state. Browser Back/Forward still needs a
  // browser test; state tests alone do not verify history API integration.
  const require = createRequire(new URL("../package.json", import.meta.url));
  const { TabRouter } = require("expo-router/build/react-navigation/routers/TabRouter");
  const router = TabRouter({ backBehavior: "fullHistory" });
  const options = { routeNames: ["tasks", "expenses", "events"], routeParamList: {}, routeGetIdList: {} };
  const first = router.getInitialState(options);
  const action = { type: "NAVIGATE", payload: { name: "tasks", params: { status: "done", cursor: "a.b" } } };
  const raw = router.getStateForAction(first, action, options);
  assert.equal(raw.history.length, first.history.length, "the installed router replaces a consecutive tab visit");
  const second = preserveTabQueryHistory(first, raw, action.type)!;
  assert.equal(second.history.length, first.history.length + 1);
  assert.deepEqual(second.routes[second.index].params, action.payload.params);
  const back = router.getStateForAction(second, { type: "GO_BACK" }, options);
  assert.equal(back.routes[back.index].params, undefined);
  assert.equal(back.history.length, first.history.length);
  assert.equal(preserveTabQueryHistory(first, raw, "REPLACE"), raw);
  assert.equal(preserveTabQueryHistory(second, router.getStateForAction(second, action, options), "NAVIGATE")!.history.length, second.history.length);
  const thirdAction = { type: "NAVIGATE", payload: { name: "tasks", params: { status: "done", cursor: "c.d" } } };
  const third = preserveTabQueryHistory(second, router.getStateForAction(second, thirdAction, options), "NAVIGATE")!;
  const backToSecond = router.getStateForAction(third, { type: "GO_BACK" }, options);
  assert.deepEqual(backToSecond.routes[backToSecond.index].params, action.payload.params);
  const eventsAction = { type: "NAVIGATE", payload: { name: "events", params: { eventId: "event-1" } } };
  const events = preserveTabQueryHistory(second, router.getStateForAction(second, eventsAction, options), "NAVIGATE")!;
  const eventTwo = { type: "NAVIGATE", payload: { name: "events", params: { eventId: "event-2" } } };
  const eventsNext = preserveTabQueryHistory(events, router.getStateForAction(events, eventTwo, options), "NAVIGATE")!;
  assert.equal(router.getStateForAction(eventsNext, { type: "GO_BACK" }, options).routes[2].params.eventId, "event-1");
});
