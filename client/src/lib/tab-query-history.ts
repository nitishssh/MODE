import type { ParamListBase, PartialState, TabNavigationState } from "expo-router/react-navigation";

type TabState = TabNavigationState<ParamListBase>;
function parametersKey(params: object | undefined) {
  return JSON.stringify(Object.entries(params ?? {}).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Expo 57 converts a tab push to NAVIGATE. Even fullHistory coalesces the
 * currently focused tab, so a changed query otherwise replaces web history.
 * Keep both parameter snapshots; the installed router restores them on Back.
 * REPLACE/SET_PARAMS and cross-tab transitions retain the router's behavior.
 */
export function preserveTabQueryHistory(previous: TabState, next: TabState | PartialState<TabState> | null, actionType: string): TabState | PartialState<TabState> | null {
  if (!next || next.stale !== false || actionType !== "NAVIGATE" || previous.index !== next.index || next.history.length !== previous.history.length) return next;
  const oldRoute = previous.routes[previous.index];
  const newRoute = next.routes[next.index];
  if (oldRoute.key !== newRoute.key || parametersKey(oldRoute.params) === parametersKey(newRoute.params)) return next;
  const history = previous.history.slice();
  const last = history.length - 1;
  if (history[last]?.key !== oldRoute.key) return next;
  history[last] = { ...history[last], params: oldRoute.params };
  return { ...next, history: [...history, { type: "route", key: newRoute.key, params: newRoute.params }] };
}
