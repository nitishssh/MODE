"use client";

import { useParams, useRouter } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { Alert, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
import { EventForm, type EventPayload } from "../../_event-form";

export default function EditEventPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id]);

  if (!can("events:write")) {
    return <EmptyState title="Organizers only" action={<LinkButton href={`/app/events/${id}`}>Back to event</LinkButton>}>Editing events needs the events:write permission.</EmptyState>;
  }

  const current = event.data?.event;
  const held = current ? current.capacity - current.available : 0;

  return (
    <>
      <PageHead eyebrow="Events" title={current ? `Edit: ${current.title}` : "Edit event"} description="Only changed fields are sent. Cancelling an event stops new bookings." />
      {event.error ? <ErrorState error={event.error} onRetry={event.reload} /> : !current ? <Skeleton rows={8} /> : (
        <Card>
          {held > 0 ? <div className="mx-mb"><Alert tone="warning">{held} seat{held === 1 ? " is" : "s are"} held or sold. Capacity cannot be set below that.</Alert></div> : null}
          <EventForm
            initial={current}
            submitLabel="Save changes"
            onCancel={() => router.push(`/app/events/${id}`)}
            onSubmit={async (payload) => {
              const patch: Partial<EventPayload> = {};
              (Object.keys(payload) as (keyof EventPayload)[]).forEach((key) => {
                if (payload[key] !== current[key]) (patch as Record<string, unknown>)[key] = payload[key];
              });
              if (Object.keys(patch).length) await api.patch(`/api/events/${encodeURIComponent(id)}`, patch);
              router.push(`/app/events/${id}`);
            }}
          />
        </Card>
      )}
    </>
  );
}
