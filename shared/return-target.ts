import { canVisitPath, overviewPath, pageForPath, type PagePath } from "./page-routes";
type RouteUser = { permissions: readonly string[] };

export type SearchValue = string | string[] | undefined;
export type SearchParameters = Record<string, SearchValue>;
export const MAX_RETURN_TARGET_LENGTH = 8192;
const unsafeText = /[\u0000-\u001f\u007f]/;
const listKeys = ["limit", "cursor", "q", "status", "sort"];
const queryKeys: Record<PagePath, readonly string[]> = {
  "/": [],
  "/dashboard": ["section"],
  "/pass": [],
  "/login": [],
  "/register": [],
  "/privacy": [],
  "/events": [...listKeys, "eventId"],
  "/door": ["eventId"],
  "/booking": [...listKeys, "eventId"],
  "/shop": listKeys,
  "/announcements": listKeys,
  "/archive": listKeys,
  "/expenses": [...listKeys, "submitterId", "eventId"],
  "/tasks": [...listKeys, "assigneeId", "eventId", "mine", "overdue"],
  "/treasury": [...listKeys, "kind", "eventId", "category"],
};

/** IDs include both UUIDs and the existing demo-* identifiers. */
export function isEntityId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function validParameter(path: PagePath, key: string, value: string): boolean {
  if (unsafeText.test(value) || !queryKeys[path].includes(key)) return false;
  if (key === "section") return ["overview", "members", "events", "announcements", "merchandise", "tasks", "expenses", "treasury"].includes(value);
  if (key.endsWith("Id")) return isEntityId(value);
  if (key === "limit") return /^[1-9]\d{0,2}$/.test(value) && Number(value) <= 100;
  if (key === "cursor") return /^[A-Za-z0-9._~-]{1,4096}$/.test(value);
  if (key === "q") return value.trim().length > 0 && value.length <= 200;
  if (key === "mine" || key === "overdue") return value === "true" || value === "false";
  if (key === "kind") return value === "income" || value === "expense";
  if (key === "category") return ["membership", "events", "expense", "merch_order", "opening_balance"].includes(value);
  if (key === "status") {
    if (path === "/tasks") return ["todo", "in_progress", "done"].includes(value);
    if (path === "/expenses") return ["submitted", "approved", "rejected", "paid"].includes(value);
    if (path === "/events" || path === "/booking") return ["draft", "published", "cancelled"].includes(value);
  }
  if (key === "sort") {
    if (path === "/tasks") return value === "createdAt_desc";
    if (path === "/expenses") return value === "submittedAt_desc";
    if (path === "/treasury") return value === "occurredAt_desc";
  }
  // Other list screens can preserve bounded filter names without treating any
  // parameter as a URL, credential, or permission grant.
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

/** Accept a local page URL only; never let URL() normalize an unsafe path. */
export function safeReturnTarget(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_RETURN_TARGET_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//") || unsafeText.test(value) || value.includes("#")) return null;
  const question = value.indexOf("?");
  const pathname = question < 0 ? value : value.slice(0, question);
  // Declared paths are plain ASCII. This rejects encoded slashes, dot segments,
  // auth/API/asset aliases and repeated encoding before a router can decode them.
  if (pathname.includes("%") || pathname.includes("//") || pathname.includes(".") || pathname.includes("\\")) return null;
  const route = pageForPath(pathname);
  if (!route || route.path === "/login" || route.path === "/register") return null;
  const search = question < 0 ? "" : value.slice(question + 1);
  try {
    // URLSearchParams tolerates malformed percent escapes; return targets do not.
    decodeURIComponent(search.replace(/\+/g, " "));
  } catch {
    return null;
  }
  const params = new URLSearchParams(search);
  const seen = new Set<string>();
  for (const [key, parameter] of params) {
    if (seen.has(key) || !validParameter(route.path, key, parameter)) return null;
    seen.add(key);
  }
  const normalized = params.toString();
  return `${route.path}${normalized ? `?${normalized}` : ""}`;
}

/** Expo exposes decoded query values. Re-encode once before validating. */
export function returnTargetForLocation(pathname: string, parameters: SearchParameters): string {
  const path = safeReturnTarget(pathname);
  if (!path) return overviewPath;
  const route = pageForPath(path)!;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    // Keep valid route state when an unrelated query value is unsupported.
    // A repeated key is ambiguous; never choose one of its values silently.
    if (typeof value === "string" && validParameter(route.path, key, value)) {
      params.append(key, value);
    }
  }
  const query = params.toString();
  return safeReturnTarget(`${path}${query ? `?${query}` : ""}`) ?? path;
}

export function authHref(pathname: "/login" | "/register", returnTo: unknown) {
  const target = safeReturnTarget(returnTo);
  return { pathname, params: target ? { returnTo: target } : {} };
}

/** Only call with a target that has passed safeReturnTarget. */
export function pageHref(target: string) {
  const safe = safeReturnTarget(target) ?? overviewPath;
  const [pathname, search] = safe.split("?");
  return { pathname: pathname as PagePath, params: Object.fromEntries(new URLSearchParams(search)) };
}

export function resolveReturnTarget(user: RouteUser, value: unknown) {
  const target = safeReturnTarget(value) ?? overviewPath;
  const href = pageHref(target);
  const sectionPermission = href.pathname === "/dashboard" ?
    ({ treasury: "ledger:read", expenses: "expenses:submit", members: "members:read" } as Record<string, string>)[href.params.section] : undefined;
  return { target, href, allowed: canVisitPath(user, href.pathname) && (!sectionPermission || user.permissions.includes(sectionPermission)) };
}

/** Standard Next exposes the existing workspace, not the Expo page collection. */
export function resolveWebReturnTarget(user: RouteUser, value: unknown, expoWeb: boolean) {
  const destination = resolveReturnTarget(user, value);
  if (expoWeb || !destination.allowed || destination.href.pathname === "/" || destination.href.pathname === "/dashboard") return destination;
  const legacySection = ({
    "/tasks": "tasks", "/expenses": "expenses", "/treasury": "treasury", "/events": "events",
    "/shop": "merchandise", "/announcements": "announcements", "/archive": "announcements", "/booking": "events",
  } as Record<string, string>)[destination.href.pathname];
  // Cursor/query paging belongs to the Expo UI. Do not send those controls to
  // the legacy whole-collection screens, which cannot apply them.
  const target = legacySection ? `/dashboard?${new URLSearchParams({ section: legacySection })}` : overviewPath;
  return { target, href: pageHref(target), allowed: true };
}
