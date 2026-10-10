import type { SessionUser } from "../generated/contracts";
export const destinations = [
  { name: "index", label: "Overview", permission: null },
  { name: "pass", label: "My pass", permission: null },
  { name: "events", label: "Events", permission: null },
  { name: "shop", label: "Shop", permission: null },
  { name: "announcements", label: "News", permission: null },
  { name: "expenses", label: "Claims", permission: "expenses:submit" },
  { name: "tasks", label: "Tasks", permission: null },
  { name: "treasury", label: "Treasury", permission: "ledger:read" },
] as const;
export function canVisit(user: SessionUser, name: string): boolean {
  const route = destinations.find((item) => item.name === name);
  return (
    !!route &&
    (!route.permission || user.permissions.includes(route.permission))
  );
}
