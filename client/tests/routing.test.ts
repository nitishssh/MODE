import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import type { SessionUser } from "../src/generated/contracts";
import { canVisitPath, pageRoutes, expoPagePaths, legacyRootTarget } from "../src/lib/navigation";
import { eventSelectionHref, resolveEventSelection } from "../src/lib/event-selection";
import { hostLoginTarget } from "../src/lib/host-login";
import { ApiError, SessionClient } from "../src/lib/session-client";
import { focusedSearchParameters, screenSearchParameters } from "../src/lib/route-parameters";
import {
  authHref,
  MAX_RETURN_TARGET_LENGTH,
  pageHref,
  resolveReturnTarget,
  resolveWebReturnTarget,
  returnTargetForLocation,
  safeReturnTarget,
} from "../src/lib/return-target";

const member: SessionUser = {
  id: "demo-member-1", clubId: "club-1", name: "Member", email: "member@example.com",
  role: "member", permissions: [],
};

test("installed Expo parser and raw route hook preserve literal percent text and nested return URLs", () => {
  const require = createRequire(new URL("../package.json", import.meta.url));
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { resolveHref } = require("expo-router/build/link/href");
  const { parseQueryParams } = require("expo-router/build/fork/getStateFromPath-forks");
  const { useRoute } = require("expo-router/build/react-navigation/core/useRoute");
  const { NavigationRouteContext } = require("expo-router/build/react-navigation/core/NavigationProvider");
  const { LocalRouteParamsContext } = require("expo-router/build/Route");
  const { useLocalSearchParams } = require("expo-router/build/hooks/useLocalSearchParams");
  const read = (url: string, raw = true) => {
    const params = parseQueryParams(url, { name: "tasks" });
    let result: ReturnType<typeof screenSearchParameters> = {};
    function Probe() {
      const route = useRoute();
      const decoded = useLocalSearchParams();
      result = raw ? screenSearchParameters(route) : decoded;
      return null;
    }
    renderToStaticMarkup(React.createElement(NavigationRouteContext.Provider, { value: { key: "task", name: "tasks", params } },
      React.createElement(LocalRouteParamsContext.Provider, { value: params }, React.createElement(Probe))));
    return result;
  };
  for (const q of ["%20", "%26", "%2526", "Music & arts", "C++ club", "100%", "club\\notes", "₹ संगीत"]) {
    const url = resolveHref({ pathname: "/tasks", params: { q } });
    const params = read(url);
    assert.equal(params.q, q, q);
    const returnTo = returnTargetForLocation("/tasks", params);
    const login = read(resolveHref(authHref("/login", returnTo)));
    assert.equal(login.returnTo, returnTo);
    const register = read(resolveHref(authHref("/register", login.returnTo)));
    assert.equal(register.returnTo, returnTo);
    assert.equal(pageHref(register.returnTo as string).params.q, q);
    const leaf = { name: "tasks", params };
    const state = { routes: [{ name: "__root", params: { q: "old parent filter" }, state: { routes: [leaf] } }] };
    assert.deepEqual(focusedSearchParameters(state), params);
  }
  assert.equal(read("/tasks?q=%2520", false).q, " ", "documents the installed local hook's extra decode");
  assert.equal(read("/tasks?q=%2526", false).q, "&");
  assert.deepEqual(read("/tasks?q=%2520&q=%2526").q, ["%20", "%26"]);
  assert.deepEqual(focusedSearchParameters({ routes: [{ params: { screen: "(app)", params: { screen: "tasks", params: { q: "%20" } } } }] }), { q: "%20" });
  assert.deepEqual(focusedSearchParameters({ routes: [{ params: { q: "old" }, state: { routes: [{ params: {} }] } }] }), {});
});

test("the shared page registry matches implemented routes and separates public landing from overview", () => {
  const paths = ["", "(app)/"].flatMap((group) =>
    readdirSync(new URL(`../src/app/${group}`, import.meta.url))
      .filter((file) => file.endsWith(".tsx") && !file.startsWith("_") && !file.startsWith("+"))
      .map((file) => file === "index.tsx" ? "/" : `/${file.slice(0, -4)}`),
  );
  assert.deepEqual(pageRoutes.map((route) => route.path).sort(), paths.sort());
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(safeReturnTarget("/members"), null);
  assert.equal(safeReturnTarget("/dashboard"), "/dashboard");
  assert.ok(!expoPagePaths.includes("/" as never));
  assert.ok(!expoPagePaths.includes("/login" as never));
  assert.ok(expoPagePaths.includes("/dashboard"));
  assert.equal(safeReturnTarget("/"), "/");
});

test("return targets reject external, encoded unsafe, reserved, and auth-loop paths", () => {
  const rejected: unknown[] = [
    undefined, null, {}, ["/tasks"], "", "tasks", " /tasks", "/tasks ",
    "https://example.com/tasks", "http://localhost/tasks", "javascript:alert(1)",
    "//example.com/tasks", "/\\example.com/tasks", "/\u0000tasks", "/tasks\r\n",
    "/%2f%2fexample.com", "/%252f%252fexample.com", "/%5cexample.com",
    "/%74asks", "/tasks%3freturnTo=//example.com", "/tasks/%2e%2e/login",
    "/events/../login", "/tasks/.", "/tasks//", "/tasks#main-content",
    "/login", "/login/", "/register?returnTo=/tasks", "/api/tasks", "/api/v2/tasks",
    "/assets/icon.png", "/_next/static/chunk.js", "/_expo/routes", "/expo/index.html",
    "/t/private-ticket", "/legacy", "/missing", "/tasks?returnTo=/login",
    "/tasks?password=secret", "/tasks?token=secret", "/tasks?session=secret",
    "/events?eventId=%2e%2e%2fapi", "/events?eventId=%252fapi",
    "/tasks?q=%0D%0Aanything", "/tasks?q=%E0%A4%A",
    "/tasks?q=100%", "/tasks?status=done&status=todo", "/tasks?%73tatus=done&status=todo",
    `/tasks?q=${"a".repeat(MAX_RETURN_TARGET_LENGTH)}`,
  ];
  for (const target of rejected) assert.equal(safeReturnTarget(target), null, String(target));
  assert.equal(safeReturnTarget("/events/"), "/events");
});

test("supported query state is bounded and preserved without retaining credentials", () => {
  const target = "/tasks?limit=25&cursor=v1.abc_def-123~&q=C%2B%2B+club&status=in_progress&sort=createdAt_desc&assigneeId=demo-member-1&eventId=demo-event-1&mine=false&overdue=true";
  const normalized = safeReturnTarget(target)!;
  assert.ok(normalized);
  assert.deepEqual(pageHref(normalized), {
    pathname: "/tasks",
    params: { limit: "25", cursor: "v1.abc_def-123~", q: "C++ club", status: "in_progress", sort: "createdAt_desc", assigneeId: "demo-member-1", eventId: "demo-event-1", mine: "false", overdue: "true" },
  });
  assert.equal(safeReturnTarget(`/tasks?cursor=${"a".repeat(4096)}`)?.length, 4110);
  assert.ok(safeReturnTarget("/tasks?q=%E0%A4%95%E0%A4%B2%E0%A4%AC"));
  assert.ok(safeReturnTarget("/expenses?eventId=demo-event-1&status=approved&sort=submittedAt_desc"));
  assert.ok(safeReturnTarget("/treasury?kind=income&category=events&sort=occurredAt_desc"));
  for (const query of ["limit=0", "limit=101", "limit=1e2", "limit=025", "cursor=", `cursor=${"a".repeat(4097)}`, "q=", `q=${"a".repeat(201)}`, "status=unknown", "sort=wrong", "mine=1", "eventId=bad/id", "eventId=", `eventId=${"a".repeat(101)}`]) {
    assert.equal(safeReturnTarget(`/tasks?${query}`), null, query);
  }
  assert.equal(returnTargetForLocation("/tasks", { password: "secret", status: "done" }), "/tasks?status=done");
  assert.equal(returnTargetForLocation("/tasks", { status: ["done", "todo"], q: "Club" }), "/tasks?q=Club");
  assert.equal(authHref("/login", "/tasks?token=secret").params.returnTo, undefined);
});

test("login and registration preserve the decoded path/query and reject ambiguous returnTo values", () => {
  const current = returnTargetForLocation("/events", { eventId: "demo-event-1", q: "Music & arts?" });
  const login = authHref("/login", current);
  const register = authHref("/register", login.params.returnTo);
  const back = authHref("/login", register.params.returnTo);
  assert.equal(back.params.returnTo, current);
  assert.deepEqual(resolveReturnTarget(member, back.params.returnTo).href, {
    pathname: "/events", params: { eventId: "demo-event-1", q: "Music & arts?" },
  });
  assert.equal(resolveReturnTarget(member, ["/tasks", "//example.com"]).target, "/dashboard");
  assert.equal(resolveReturnTarget(member, "/login?returnTo=/tasks").target, "/dashboard");
});

test("return targets do not grant route permissions after login or a role change", () => {
  const target = "/door?eventId=demo-event-1";
  const denied = resolveReturnTarget(member, target);
  assert.equal(denied.target, target);
  assert.equal(denied.allowed, false, "forbidden destinations must show a denial rather than silently open overview");
  assert.equal(resolveReturnTarget({ ...member, role: "volunteer", permissions: ["tickets:check_in"] }, target).allowed, true);
  assert.equal(resolveReturnTarget({ ...member, role: "admin" }, target).allowed, false);
  assert.equal(canVisitPath(member, "/expenses"), false);
  assert.equal(canVisitPath(member, "/treasury"), false);
  assert.equal(canVisitPath(member, "/tasks"), true);
  assert.equal(canVisitPath(member, "/archive"), true);
  assert.equal(canVisitPath(member, "/members"), false);
});

test("session expiry keeps the current destination and rechecks the replacement identity", async () => {
  let activeUser: SessionUser = { ...member, role: "volunteer", permissions: ["tickets:check_in"] };
  let expired = false;
  const client = new SessionClient({
    platform: "web",
    store: { async read() { return null; }, async write() {}, async clear() {} },
    fetch: async (url) => {
      const failure = expired && !String(url).endsWith("/login") && !String(url).endsWith("/register");
      return new Response(JSON.stringify(failure ? { error: "Expired" } : { user: activeUser }), { status: failure ? 401 : 200 });
    },
  });
  await client.bootstrap();
  const location = returnTargetForLocation("/door", { eventId: "demo-event-1" });
  expired = true;
  await assert.rejects(client.request("/api/events"), ApiError);
  assert.equal(client.snapshot().status, "signedOut");
  const login = authHref("/login", location);
  activeUser = member;
  await client.signIn(member.email, "password");
  assert.equal(client.snapshot().status, "signedIn");
  assert.equal(resolveReturnTarget(client.snapshot().user!, login.params.returnTo).allowed, false);
  const registration = authHref("/register", login.params.returnTo);
  await client.signUp(member.name, member.email, "password");
  assert.equal(resolveReturnTarget(client.snapshot().user!, registration.params.returnTo).target, location);
  assert.equal(resolveReturnTarget(client.snapshot().user!, registration.params.returnTo).allowed, false);
});

test("bookmarked events resolve only within the loaded club and never select a different event", () => {
  const events = [{ id: "demo-event-1", title: "First" }, { id: "38fefc3a-7148-44f8-a1c7-ece3a1f99b79", title: "Second" }];
  assert.deepEqual(resolveEventSelection(undefined, events), { id: null, event: null, error: null });
  assert.equal(resolveEventSelection(events[1].id, events).event, events[1]);
  const waiting = resolveEventSelection("demo-event-1", undefined);
  assert.equal(waiting.id, "demo-event-1"); assert.equal(waiting.error, null);
  const missing = resolveEventSelection("other-club-event", events);
  assert.equal(missing.event, null); assert.match(missing.error!, /unavailable in this club/);
  const removed = resolveEventSelection("demo-event-1", events.slice(1));
  assert.equal(removed.event, null); assert.match(removed.error!, /removed/);
  for (const value of ["", "../event", ["demo-event-1", "other-event"], "x".repeat(101)]) {
    const invalid = resolveEventSelection(value, events);
    assert.equal(invalid.event, null); assert.match(invalid.error!, /invalid/);
  }
});

test("event selection URLs reconstruct forward/back state and clearing selection", () => {
  const first = eventSelectionHref("/events", { q: "Music & arts", limit: "25" }, "demo-event-1");
  const second = eventSelectionHref("/events", first.params, "demo-event-2");
  assert.equal(first.params.eventId, "demo-event-1");
  assert.equal(second.params.eventId, "demo-event-2");
  assert.equal(second.params.q, "Music & arts");
  assert.deepEqual(eventSelectionHref("/events", second.params, null), { pathname: "/events", params: { q: "Music & arts", limit: "25" } });
  assert.deepEqual(eventSelectionHref("/door", {}, "demo-event-1"), { pathname: "/door", params: { eventId: "demo-event-1" } });
  assert.deepEqual(eventSelectionHref("/booking", {}, "demo-event-1"), { pathname: "/booking", params: { eventId: "demo-event-1" } });
  assert.deepEqual(eventSelectionHref("/events/", { token: "secret", unrelated: "value" }, "demo-event-1"), { pathname: "/events", params: { eventId: "demo-event-1" } });
  assert.throws(() => eventSelectionHref("/tasks", {}, "demo-event-1"));
  assert.throws(() => eventSelectionHref("/door", {}, "../event"));
});


test("host sign-in preserves one encoded copy of return state without changing destinations", () => {
  for (const q of ["%20", "%26", "%2526", "Music & arts", "C++ club", "100%", "club\\notes", "₹ संगीत"]) {
    const returnTo = returnTargetForLocation("/tasks", {q, status: "todo"});
    const login = new URL(hostLoginTarget(returnTo), "https://mode.example");
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("returnTo"), returnTo);
    assert.equal(pageHref(safeReturnTarget(login.searchParams.get("returnTo"))!).params.q, q);
  }
  assert.equal(hostLoginTarget(safeReturnTarget("//other.example")), "/login");
  assert.equal(safeReturnTarget("/dashboard?section=tasks"), "/dashboard?section=tasks");
  assert.equal(safeReturnTarget("/dashboard?section=missing"), null);
});

test("old root bookmarks route to the matching profile and preserve landing anchors", () => {
  assert.equal(legacyRootTarget("#overview", true), "/dashboard");
  assert.equal(legacyRootTarget("#tasks", true), "/tasks");
  assert.equal(legacyRootTarget("#members", true), "/legacy#members");
  assert.equal(legacyRootTarget("#my-expenses", true), "/expenses");
  assert.equal(legacyRootTarget("#tasks", false), "/dashboard?section=tasks");
  for (const hash of ["", "#main-content", "#top", "#workflow", "#club-tools", "#plans", "#contact", "#unknown", "#%2ftasks"]) {
    assert.equal(legacyRootTarget(hash, true), null, hash);
    assert.equal(legacyRootTarget(hash, false), null, hash);
  }
});


test("Next login only returns to implemented pages in its delivery profile", () => {
  const requested = "/tasks?status=todo&q=Club&limit=25&cursor=v1.cursor";
  assert.equal(resolveWebReturnTarget(member, requested, true).target, requested);
  assert.equal(resolveWebReturnTarget(member, requested, false).target, "/dashboard?section=tasks");
  assert.equal(resolveWebReturnTarget(member, "/pass", false).target, "/dashboard");
  assert.equal(resolveWebReturnTarget(member, "/", false).target, "/");
  assert.equal(resolveWebReturnTarget(member, "/dashboard?section=events", false).target, "/dashboard?section=events");
  for (const expoWeb of [false, true]) {
    assert.equal(resolveWebReturnTarget(member, "/door?eventId=demo-event-1", expoWeb).allowed, false);
    assert.equal(resolveWebReturnTarget(member, "/dashboard?section=treasury", expoWeb).allowed, false);
    assert.equal(resolveWebReturnTarget(member, "/dashboard?section=members", expoWeb).allowed, false);
    assert.equal(resolveWebReturnTarget(member, ["/tasks", "//other.example"], expoWeb).target, "/dashboard");
  }
  const officer = {...member, permissions: ["ledger:read", "members:read"]};
  assert.equal(resolveWebReturnTarget(officer, "/treasury", false).target, "/dashboard?section=treasury");
  assert.equal(resolveWebReturnTarget(officer, "/dashboard?section=members", false).allowed, true);
});
