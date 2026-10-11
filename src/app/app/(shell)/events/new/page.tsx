"use client";

import { useRouter } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api } from "../../../_lib/api";
import { useSession } from "../../../_lib/session";
import { useT } from "../../../_lib/i18n";
import { EmptyState, FormPanel, LinkButton, PageHead } from "../../../_components/ui";
import { EventForm } from "../_event-form";

export default function NewEventPage() {
  const { t } = useT();
  const router = useRouter();
  const { can } = useSession();

  if (!can("events:write")) {
    return (
      <section className="panel">
        <EmptyState title={t("events.new.organizersOnly")} icon="calendar" action={<LinkButton href="/app/events">{t("events.new.backToEvents")}</LinkButton>}>{t("events.new.needsPermission")}</EmptyState>
      </section>
    );
  }

  return (
    <>
      <PageHead eyebrow={<>{t("events.eyebrowClub")} <span>/</span> {t("events.eyebrow")}</>} title={t("events.new.title")} description={t("events.new.description")} />
      <FormPanel title={t("events.form.panelTitle")} description={t("events.form.panelDescription")} onClose={() => router.push("/app/events")}>
        <EventForm
          submitLabel={t("events.new.submit")}
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
