import { useState } from "react";
import type { EventDetails } from "../../generated/contracts";
import { useResource } from "../../lib/use-resource";
import { Door } from "../../components/door";
import { Action, Copy, ErrorNotice, LoadingRows, Row, Screen } from "../../components/ui";

export default function DoorScanner() {
  const events = useResource<{ events: EventDetails[] }>("/api/events");
  const [eventId, setEventId] = useState<string | null>(null);
  const selected = events.data?.events.find(event => event.id === eventId);

  return <Screen title="Door register">
    <Copy>Choose an event, then scan a QR code or enter a member or ticket short code.</Copy>
    <ErrorNotice error={events.error} />
    <Action onPress={() => void events.reload()}>Refresh events</Action>
    {events.loading && !events.data && <LoadingRows />}
    {events.data?.events.length === 0 && <Copy>No events are published.</Copy>}
    {events.data?.events.map(event => <Row key={event.id}>
      <Copy kind="label">{event.title}</Copy>
      <Copy>{event.venue} · {new Date(event.startsAt).toLocaleString()}</Copy>
      <Action primary={event.id === eventId} onPress={() => setEventId(event.id)}>Select {event.title}</Action>
    </Row>)}
    {selected && <Door key={selected.id} eventId={selected.id} eventTitle={selected.title} />}
  </Screen>;
}
