import { isEntityId, pageHref, returnTargetForLocation, type SearchParameters } from "./return-target";
import { pageForPath } from "./navigation";

export function resolveEventSelection<T extends { id: string }>(value: unknown, events: readonly T[] | undefined) {
  if (value === undefined) return { id: null, event: null, error: null };
  if (!isEntityId(value)) {
    return { id: null, event: null, error: "This event link is invalid. Choose an event below." };
  }
  const event = events?.find((item) => item.id === value) ?? null;
  return {
    id: value,
    event,
    error: events && !event
      ? "The selected event is unavailable in this club. It may have been removed or your access may have changed. Choose an event below."
      : null,
  };
}

export function eventSelectionHref(pathname: string, parameters: SearchParameters, eventId: string | null) {
  if (eventId !== null && !isEntityId(eventId)) throw new Error("Invalid event identifier.");
  const page = pageForPath(pathname);
  if (!page || !["/events", "/door", "/booking"].includes(page.path)) throw new Error("This page does not select events.");
  const next = { ...parameters };
  if (eventId === null) delete next.eventId;
  else next.eventId = eventId;
  return pageHref(returnTargetForLocation(page.path, next));
}
