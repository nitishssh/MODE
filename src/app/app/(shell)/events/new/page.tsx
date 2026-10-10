"use client";

import { useRouter } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { EmptyState, FormPanel, LinkButton, PageHead } from "../../../_components/ui";
import { EventForm } from "../_event-form";

export default function NewEventPage() {
  const router = useRouter();
  const { can } = useSession();

  if (!can("events:write")) {
    return (
      <section className="panel">
        <EmptyState title="Organizers only" icon="calendar" action={<LinkButton href="/app/events">Back to events</LinkButton>}>Creating events needs the events:write permission.</EmptyState>
      </section>
    );
  }

  return (
    <>
      <PageHead eyebrow={<>CLUB <span>/</span> EVENTS</>} title="New event" description="Published events open bookings immediately. Save as a draft to keep it hidden from members." />
      <FormPanel title="Event details" description="Prices are in rupees; enter 0 for a free ticket." onClose={() => router.push("/app/events")}>
        <EventForm
          submitLabel="Create event"
          onCancel={() => router.push("/app/events")}
          onSubmit={async (payload) => {
            const result = await api.post<{ event: EventDetails }>("/api/events", payload);
            router.push(`/app/events/${result.event.id}`);
          }}
        />
      </FormPanel>
    </>
  );
}
