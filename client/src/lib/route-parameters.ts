import type { SearchParameters } from "./return-target";

type ParameterRoute = { params?: object; state?: ParameterState };
type ParameterState = { index?: number; routes: readonly ParameterRoute[] };

/** Navigation params are already decoded by the installed URL parser. */
export function screenSearchParameters(route: ParameterRoute): SearchParameters {
  return (route.params ?? {}) as SearchParameters;
}

/** Read the focused leaf, including a pending nested navigation before mount. */
export function focusedSearchParameters(state: ParameterState): SearchParameters {
  let route = state.routes[state.index ?? 0];
  while (route?.state) route = route.state.routes[route.state.index ?? 0];
  let parameters = route?.params as (Record<string, unknown> | undefined);
  while (typeof parameters?.screen === "string" && parameters.params &&
    typeof parameters.params === "object" && !Array.isArray(parameters.params)) {
    parameters = parameters.params as Record<string, unknown>;
  }
  return (parameters ?? {}) as SearchParameters;
}
