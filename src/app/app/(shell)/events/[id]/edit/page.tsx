"use client";

import { useParams, useRouter } from "next/navigation";
import type { EventDetails } from "@/lib/contracts";
import { api, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { useT } from "../../../../_lib/i18n";
import { EmptyState, ErrorState, FormPanel, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
import { Icon } from "../../../../_components/icons";
import { EventForm, type EventPayload } from "../../_event-form";

export default function EditEventPage() {
  const { t } = useT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id]);

  if (!can("events:write")) {
    return (
      <section className="panel">
        <EmptyState title={t("events.new.organizersOnly")} icon="calendar" action={<LinkButton href={`/app/events/${id}`}>{t("events.edit.backToEvent")}</LinkButton>}>{t("events.edit.needsPermission")}</EmptyState>
      </section>
    );
  }

  const current = event.data?.event;
  const held = current ? current.capacity - current.available : 0;

  return (
    <>
      <PageHead eyebrow={<>{t("events.eyebrowClub")} <span>/</span> {t("events.eyebrow")}</>} title={current ? t("events.edit.titleFor", { title: current.title }) : t("events.edit.title")} description={t("events.edit.description")} />
      {event.error ? <ErrorState error={event.error} onRetry={event.reload} /> : !current ? <section className="panel task-create-panel"><Skeleton rows={8} /></section> : (
        <>
          {held > 0 ? (
            <div className="outstanding-notice">
              <div className="mx-row" style={{ flexWrap: "nowrap" }}><Icon name="alert" size={16} /><div><strong>{held === 1 ? t("events.edit.heldOne", { count: held }) : t("events.edit.heldMany", { count: held })}</strong><p>{t("events.edit.heldBody")}</p></div></div>
            </div>
          ) : null}
          <FormPanel title={t("events.form.panelTitle")} description={t("events.form.panelDescription")} onClose={() => router.push(`/app/events/${id}`)}>
            <EventForm
              initial={current}
              submitLabel={t("events.edit.submit")}
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
