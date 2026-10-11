import { pageHref, returnTargetForLocation, safeReturnTarget, type SearchParameters } from "./return-target";

export type ListKind = "tasks" | "expenses" | "ledger";
export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
export const listRoutes = {
  tasks: { page: "/tasks", api: "/api/v2/tasks", sort: "createdAt_desc" },
  expenses: { page: "/expenses", api: "/api/v2/expenses", sort: "submittedAt_desc" },
  ledger: { page: "/treasury", api: "/api/v2/ledger/entries", sort: "occurredAt_desc" },
} as const;
const commonKeys = ["limit", "cursor", "sort", "q", "eventId"];
const queryKeys = {
  tasks: [...commonKeys, "status", "assigneeId", "mine", "overdue"],
  expenses: [...commonKeys, "status", "submitterId"],
  ledger: [...commonKeys, "kind", "category"],
};

export function readListQuery(kind: ListKind, input: SearchParameters) {
  const route = listRoutes[kind];
  const params = new URLSearchParams();
  let error: string | null = null;
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!queryKeys[kind].includes(key)) error = "This list link has an unsupported filter. Reset filters to continue.";
    if (typeof value !== "string") {
      error = "This list link repeats a filter. Reset filters to continue.";
      continue;
    }
    params.set(key, value);
  }
  if (!safeReturnTarget(`${route.page}${params.size ? `?${params}` : ""}`)) {
    error = "This list link has an invalid filter or cursor. Restart the page or reset filters.";
  }
  if (kind === "tasks" && params.get("mine") === "true" && params.has("assigneeId")) {
    error = "Choose either My tasks or an assignee filter. Reset filters to continue.";
  }
  const sanitized = pageHref(returnTargetForLocation(route.page, input)).params;
  const values: Record<string, string> = { ...sanitized };
  if (values.q) values.q = values.q.trim();
  values.limit ??= String(DEFAULT_PAGE_LIMIT);
  values.sort ??= route.sort;
  const query = new URLSearchParams(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))).toString();
  return {
    parameters: values,
    limit: Number(values.limit),
    cursor: values.cursor ?? null,
    error,
    path: error ? null : `${route.api}?${query}`,
    key: error ? JSON.stringify(input) : query,
  };
}

/** Every filter change starts a fresh server snapshot; page links retain filters. */
export function listHref(kind: ListKind, input: SearchParameters, patch: Record<string, string | null>, paging = false) {
  const values = { ...readListQuery(kind, input).parameters };
  if (!paging) delete values.cursor;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value.trim() === "") delete values[key];
    else values[key] = key === "q" ? value.trim() : value;
  }
  if (patch.mine === "true") delete values.assigneeId;
  const next = readListQuery(kind, values);
  if (next.error) throw new Error(next.error);
  return pageHref(returnTargetForLocation(listRoutes[kind].page, values));
}
