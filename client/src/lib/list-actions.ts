import { listHref, type ListKind } from "./list-query";
import type { SearchParameters } from "./return-target";
import { message } from "./session-client";

export type ListNavigationError = { key: string; error: string } | null;

/** Recovery must clear local errors even when navigation leaves the URL unchanged. */
export function createListActions(options: {
  kind: ListKind; parameters: SearchParameters; key: string;
  push(href: ReturnType<typeof listHref>): void;
  setError(error: ListNavigationError): void;
  resetDraft(): void;
  load(): Promise<void>;
}) {
  function navigate(href: () => ReturnType<typeof listHref>) {
    options.setError(null);
    try { options.push(href()); }
    catch (error) { options.setError({ key: options.key, error: message(error) }); }
  }
  return {
    updateFilters: (patch: Record<string, string | null>) => navigate(() => listHref(options.kind, options.parameters, patch)),
    clearFilters: () => {
      options.resetDraft();
      navigate(() => listHref(options.kind, {}, {}));
    },
    restart: () => navigate(() => listHref(options.kind, options.parameters, { cursor: null }, true)),
    reload: () => { options.setError(null); return options.load(); },
    nextCursor: (cursor: string) => navigate(() => listHref(options.kind, options.parameters, { cursor }, true)),
  };
}
