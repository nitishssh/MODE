import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { listRoutes, readListQuery, type ListKind } from "./list-query";
import { PageLoader } from "./page-loader";
import { useSession } from "./session";
import { createListActions, type ListNavigationError } from "./list-actions";
import { useScreenSearchParams } from "./use-screen-search-params";

export function usePagedList<T extends { id: string }>(kind: ListKind) {
  const parameters = useScreenSearchParams();
  const router = useRouter();
  const { client, user, status } = useSession();
  const query = readListQuery(kind, { ...parameters });
  const [navigationError, setNavigationError] = useState<ListNavigationError>(null);
  const [filterRevision, setFilterRevision] = useState(0);
  const { path, limit, cursor } = query;
  const enabled = !!path && !!user && status === "signedIn";
  // A replacement user object (including club, role or re-login) gets an empty
  // store immediately, before effects run. In-flight results check it as well.
  const loader = useMemo(() => new PageLoader<T>(
    () => client.request(path!), limit, cursor,
    () => enabled && client.snapshot().user === user && client.snapshot().status === "signedIn",
    enabled,
  ), [client, user, path, limit, cursor, enabled]);
  const state = useSyncExternalStore(loader.subscribe, loader.snapshot, loader.snapshot);
  useEffect(() => {
    loader.activate();
    if (enabled) void loader.load();
    return loader.dispose;
  }, [loader, enabled]);
  const actions = () => createListActions({
    kind, parameters: { ...parameters }, key: query.key, push: href => router.push(href),
    setError: setNavigationError, load: loader.load,
    resetDraft: () => setFilterRevision(revision => revision + 1),
  });
  return {
    ...state,
    query,
    filterKey: `${query.key}:${filterRevision}`,
    error: query.error ?? (navigationError?.key === query.key ? navigationError.error : null) ?? state.error,
    reload: () => actions().reload(),
    updateFilters: (patch: Record<string, string | null>) => actions().updateFilters(patch),
    clearFilters: () => actions().clearFilters(),
    restart: () => actions().restart(),
    next: () => {
      if (!state.loading && !state.error && !query.error && state.data?.hasMore && state.data.nextCursor) {
        actions().nextCursor(state.data.nextCursor);
      }
    },
    pagePath: listRoutes[kind].page,
  };
}
