import type { Role, SessionUser } from "@/lib/contracts";

/**
 * Which workspace sections each role sees. The server still enforces every
 * permission on every request; this matrix decides what the sidebar offers and
 * which URLs render for a role, in visibly different tiers: members, then
 * volunteers, then treasurers, then organizers, and the club lead sees everything.
 */
export type Section =
  | "overview" | "members" | "events" | "door" | "announcements" | "shop" | "tasks"
  | "expenses" | "treasury" | "tickets" | "pass" | "notifications" | "settings";

/** Sections every signed-in person keeps: their own pass, notices and account. */
const PERSONAL: Section[] = ["pass", "notifications", "settings"];

/**
 * Tiered slices, smallest first. The first entry is the role's landing page.
 * Only the club lead holds everything; organizers lack the ledger; treasurers
 * run money and desks; volunteers run the door and their tasks; members use
 * the club's public life and their own tickets.
 */
const ROLE_SECTIONS: Record<Role, Section[]> = {
  member: ["events", "announcements", "shop", "tickets", ...PERSONAL],
  volunteer: ["door", "tasks", "announcements", "expenses", ...PERSONAL],
  treasurer: ["overview", "members", "events", "shop", "expenses", "treasury", "announcements", ...PERSONAL],
  organizer: ["overview", "members", "events", "door", "announcements", "shop", "tasks", "expenses", "tickets", ...PERSONAL],
  admin: ["overview", "members", "events", "door", "announcements", "shop", "tasks", "expenses", "treasury", "tickets", ...PERSONAL],
};

/** Permissions a section additionally needs, so a role list can never outrun the server matrix. */
const SECTION_PERMISSION: Partial<Record<Section, string>> = {
  members: "members:read",
  treasury: "ledger:read",
  door: "tickets:check_in",
};

export function allowedSections(user: SessionUser): Set<Section> {
  const sections = ROLE_SECTIONS[user.role] ?? PERSONAL;
  return new Set(sections.filter((section) => {
    const permission = SECTION_PERMISSION[section];
    return !permission || user.permissions.includes(permission);
  }));
}

export function canAccess(user: SessionUser, section: Section): boolean {
  return allowedSections(user).has(section);
}

/** The workspace section a URL belongs to; null for the auth pages. */
export function sectionFor(pathname: string): Section | null {
  if (pathname === "/app") return "overview";
  if (/^\/app\/door(\/|$)/.test(pathname) || /^\/app\/events\/[^/]+\/door(\/|$)/.test(pathname)) return "door";
  const first = pathname.replace(/^\/app\//, "").split("/")[0];
  switch (first) {
    case "members": case "events": case "announcements": case "shop": case "tasks":
    case "expenses": case "treasury": case "tickets": case "pass": case "notifications": case "settings":
      return first;
    default:
      return null;
  }
}

export const SECTION_HOME: Record<Section, string> = {
  overview: "/app", members: "/app/members", events: "/app/events", door: "/app/door", announcements: "/app/announcements",
  shop: "/app/shop", tasks: "/app/tasks", expenses: "/app/expenses", treasury: "/app/treasury", tickets: "/app/tickets",
  pass: "/app/pass", notifications: "/app/notifications", settings: "/app/settings",
};

/** Where a role lands after signing in: the first section of its slice. */
export function homeFor(user: SessionUser): string {
  const [first] = [...allowedSections(user)];
  return first ? SECTION_HOME[first] : "/app/pass";
}
