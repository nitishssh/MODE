type RouteUser = { permissions: readonly string[] };
export const destinations = [
  { name: "dashboard", path: "/dashboard", label: "Overview", permission: null },
  { name: "pass", path: "/pass", label: "My pass", permission: null },
  { name: "events", path: "/events", label: "Events", permission: null },
  { name: "door", path: "/door", label: "Door scanner", permission: "tickets:check_in" },
  { name: "shop", path: "/shop", label: "Shop", permission: null },
  { name: "announcements", path: "/announcements", label: "News", permission: null },
  { name: "expenses", path: "/expenses", label: "Claims", permission: "expenses:submit" },
  { name: "tasks", path: "/tasks", label: "Tasks", permission: null },
  { name: "treasury", path: "/treasury", label: "Treasury", permission: "ledger:read" },
] as const;

// Shared by the HTTP host and Expo: only implemented routes are published.
export const pageRoutes = [
  { name: "index", path: "/", label: "MODE", permission: null, access: "public" },
  ...destinations.map((route) => ({ ...route, access: "signedIn" as const })),
  { name: "login", path: "/login", label: "Sign in", permission: null, access: "public" },
  { name: "register", path: "/register", label: "Register", permission: null, access: "public" },
  { name: "booking", path: "/booking", label: "Guest booking", permission: null, access: "public" },
  { name: "archive", path: "/archive", label: "Announcement archive", permission: null, access: "public" },
  { name: "privacy", path: "/privacy", label: "Privacy policy", permission: null, access: "public" },
] as const;

export type PagePath = (typeof pageRoutes)[number]["path"];
export const overviewPath = "/dashboard" satisfies PagePath;

export function pageForPath(pathname: string) {
  const path = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  return pageRoutes.find((route) => route.path === path);
}

export function canVisitPath(user: RouteUser, pathname: string): boolean {
  const route = pageForPath(pathname);
  return !!route && (!route.permission || user.permissions.includes(route.permission));
}

export function canVisit(user: RouteUser, name: string): boolean {
  const route = destinations.find((item) => item.name === name);
  return (
    !!route &&
    (!route.permission || user.permissions.includes(route.permission))
  );
}

/** Next owns the public landing and sign-in; Expo supplies all remaining pages. */
export const expoPagePaths = pageRoutes.filter(route => route.path !== "/" && route.path !== "/login").map(route => route.path);

const legacySections = {
  overview: "/dashboard", members: "/legacy#members", events: "/events",
  announcements: "/announcements", merchandise: "/shop", tasks: "/tasks",
  expenses: "/expenses", "my-expenses": "/expenses", treasury: "/treasury",
} as const;

/** Fragments never reach Next. Translate only known old workspace bookmarks. */
export function legacyRootTarget(hash: string, expoWeb: boolean): string | null {
  const section = hash.replace(/^#/, "").toLowerCase();
  if (!Object.hasOwn(legacySections, section)) return null;
  if (expoWeb) return legacySections[section as keyof typeof legacySections];
  return `/dashboard?${new URLSearchParams({ section: section === "my-expenses" ? "expenses" : section })}`;
}
