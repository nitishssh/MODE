import { usePathname, useRouter } from "expo-router";
import { eventSelectionHref, resolveEventSelection } from "./event-selection";
import { useScreenSearchParams } from "./use-screen-search-params";

export function useEventSelection<T extends { id: string }>(events: readonly T[] | undefined) {
  const parameters = useScreenSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  return {
    ...resolveEventSelection(parameters.eventId, events),
    select: (id: string | null) => router.push(eventSelectionHref(pathname, parameters, id)),
  };
}
