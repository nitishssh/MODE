"use client";

import { useParams, useRouter } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { EmptyState, ErrorState, FormPanel, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
import { Icon } from "../../../../_components/icons";
import { EventForm, type EventPayload } from "../../_event-form";

export default function EditEventPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id]);

  if (!can("events:write")) {
    return (
      <section className="panel">
        <EmptyState title="Organizers only" icon="calendar" action={<LinkButton href={`/app/events/${id}`}>Back to event</LinkButton>}>Editing events needs the events:write permission.</EmptyState>
      </section>
    );
  }

  const current = event.data?.event;
  const held = current ? current.capacity - current.available : 0;

  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> EVENTS</>} title={current ? `Edit: ${current.title}` : "Edit event"} description="Only changed fields are sent. Cancelling an event stops new bookings." />
      {event.error ? <ErrorState error={event.error} onRetry={event.reload} /> : !current ? <section className="panel task-create-panel"><Skeleton rows={8} /></section> : (
        <>
          {held > 0 ? (
            <div className="outstanding-notice">
              <div className="mx-row" style={{ flexWrap: "nowrap" }}><Icon name="alert" size={16} /><div><strong>{held} seat{held === 1 ? " is" : "s are"} held or sold.</strong><p>Capacity cannot be set below that.</p></div></div>
            </div>
          ) : null}
          <FormPanel title="Event details" description="Prices are in rupees; enter 0 for a free ticket." onClose={() => router.push(`/app/events/${id}`)}>
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
          </FormPanel>
        </>
      )}
    </>
  );
}
