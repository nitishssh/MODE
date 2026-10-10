export const ROLES = ["member", "volunteer", "organizer", "treasurer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "roles:manage",
  "members:create",
  "members:read",
  "members:lookup",
  "membership:record_payment",
  "membership:reminders",
  "events:write",
  "events:report",
  "tickets:check_in",
  "bookings:create",
  "payments:confirm",
  "products:write",
  "orders:create",
  "orders:fulfil",
  "ledger:read",
  "ledger:summary",
  "expenses:submit",
  "expenses:review",
  "announcements:write",
  "outbox:manage",
  "tasks:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const EVERYONE: Permission[] = ["bookings:create", "orders:create", "expenses:submit"];

/** Role matrix. `admin` (club lead) holds every permission. Mirrored in docs/API.md. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  member: new Set(EVERYONE),
  volunteer: new Set([...EVERYONE, "tickets:check_in", "members:lookup", "ledger:summary"]),
  organizer: new Set([
    ...EVERYONE,
    "members:create",
    "members:read",
    "members:lookup",
    "ledger:summary",
    "membership:record_payment",
    "membership:reminders",
    "events:write",
    "events:report",
    "tickets:check_in",
    "payments:confirm",
    "products:write",
    "orders:fulfil",
    "announcements:write",
    "outbox:manage",
    "tasks:write",
  ]),
  treasurer: new Set([
    ...EVERYONE,
    "members:read",
    "members:lookup",
    "ledger:summary",
    "membership:record_payment",
    "events:report",
    "payments:confirm",
    "ledger:read",
    "expenses:review",
  ]),
  admin: new Set(PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
