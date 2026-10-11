import { useState } from "react";
import { View } from "react-native";
import type { CursorPage } from "../generated/contracts";
import type { ListKind, readListQuery } from "../lib/list-query";
import { Action, AsOf, Copy, ErrorNotice, Row } from "./ui";
import { Field } from "./forms";

const statusFilters = {
  tasks: [["todo", "To do"], ["in_progress", "In progress"], ["done", "Done"]],
  expenses: [["submitted", "Submitted"], ["approved", "Approved"], ["rejected", "Rejected"], ["paid", "Paid"]],
  ledger: [["income", "Income"], ["expense", "Expense"]],
};

export function ListFilters({ kind, query, update, clear }: {
  kind: ListKind; query: ReturnType<typeof readListQuery>;
  update(patch: Record<string, string | null>): void; clear(): void;
}) {
  const [search, setSearch] = useState(query.parameters.q ?? "");
  const key = kind === "ledger" ? "kind" : "status";
  return <Row>
    <Copy kind="label">Filter {kind === "ledger" ? "ledger entries" : kind}</Copy>
    <Field label={`Search ${kind === "ledger" ? "ledger" : kind}`} value={search} onChangeText={setSearch} maxLength={200}
      onSubmitEditing={() => update({ q: search })} />
    <Action onPress={() => update({ q: search })}>Apply search</Action>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Action primary={!query.parameters[key]} onPress={() => update({ [key]: null })}>All {kind === "ledger" ? "entries" : kind}</Action>
      {statusFilters[kind].map(([value, label]) => <Action key={value} primary={query.parameters[key] === value} onPress={() => update({ [key]: value })}>{label}</Action>)}
    </View>
    {kind === "tasks" && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Action primary={query.parameters.mine === "true"} onPress={() => update({ mine: query.parameters.mine === "true" ? null : "true" })}>My tasks{query.parameters.mine === "true" ? " · on" : ""}</Action>
      <Action primary={query.parameters.overdue === "true"} onPress={() => update({ overdue: query.parameters.overdue === "true" ? null : "true" })}>Overdue only{query.parameters.overdue === "true" ? " · on" : ""}</Action>
    </View>}
    {(["eventId", "assigneeId", "submitterId", "category"] as const).filter(name => query.parameters[name]).map(name => <View key={name} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Copy>{({ eventId: "Event", assigneeId: "Assignee", submitterId: "Submitter", category: "Category" })[name]}: {query.parameters[name]}</Copy>
      <Action onPress={() => update({ [name]: null })}>Clear {({ eventId: "event", assigneeId: "assignee", submitterId: "submitter", category: "category" })[name]} filter</Action>
    </View>)}
    <Copy>Rows per page: {query.limit}. Newest first.</Copy>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[25, 50, 100].map(limit => <Action key={limit} primary={query.limit === limit} onPress={() => update({ limit: String(limit) })}>{limit} per page</Action>)}</View>
    <Action onPress={clear}>Reset filters</Action>
  </Row>;
}

export function ListPageControls({ page, loading, error, time, cursor, next, restart, reload, queryError }: {
  page: CursorPage<unknown> | null; loading: boolean; error: string | null; time: Date | null; cursor: string | null;
  next(): void; restart(): void; reload(): Promise<void>; queryError: string | null;
}) {
  return <Row>
    <AsOf time={time} refreshing={loading} />
    <ErrorNotice error={error} />
    {page && <Copy accessibilityLiveRegion="polite">{page.items.length} {page.items.length === 1 ? "record" : "records"} on this page{!page.hasMore ? " · end of results" : ""}.</Copy>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Action disabled={loading || !!queryError} onPress={() => void reload()}>{error ? "Retry page" : "Refresh page"}</Action>
      <Action disabled={!cursor || !!queryError} onPress={restart}>Restart from first page</Action>
      <Action disabled={loading || !!error || !page?.hasMore} onPress={next}>Next page</Action>
    </View>
    {cursor && <Copy>Filters and this page are saved in the link. After signing in again, restart the list if this page has expired.</Copy>}
  </Row>;
}
