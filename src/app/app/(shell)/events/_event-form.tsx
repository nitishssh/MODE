"use client";

import { useState, type FormEvent } from "react";
import type { EventDetails, EventStatus } from "@/lib/contracts";
import { ApiError } from "../../_lib/api";
import { useT } from "../../_lib/i18n";
import { fromLocalInput, paiseToRupees, rupeesToPaise, toLocalInput } from "../../_lib/format";
import { Button } from "../../_components/ui";

/* The legacy .task-form-grid form: label-wrapped inputs, .form-actions, .form-error. */

export type EventPayload = {
  title: string;
  description: string;
  startsAt: string;
  venue: string;
  capacity: number;
  memberPricePaise: number;
  guestPricePaise: number;
  fundraiserGoalPaise: number;
  status: EventStatus;
};

type Form = { title: string; description: string; startsAt: string; venue: string; capacity: string; memberPrice: string; guestPrice: string; fundraiserGoal: string; status: EventStatus };
type Errors = Partial<Record<keyof Form, string>>;

function toForm(event?: EventDetails): Form {
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    startsAt: toLocalInput(event?.startsAt),
    venue: event?.venue ?? "",
    capacity: event ? String(event.capacity) : "",
    memberPrice: event ? paiseToRupees(event.memberPricePaise) : "",
    guestPrice: event ? paiseToRupees(event.guestPricePaise) : "",
    fundraiserGoal: event ? paiseToRupees(event.fundraiserGoalPaise) : "0",
    status: event?.status ?? "published",
  };
}

const FIELD_MAP: Record<string, keyof Form> = { title: "title", description: "description", startsAt: "startsAt", venue: "venue", capacity: "capacity", memberPricePaise: "memberPrice", guestPricePaise: "guestPrice", fundraiserGoalPaise: "fundraiserGoal", status: "status" };

function FieldError({ message }: { message?: string }) {
  return message ? <span className="error-text" role="alert" style={{ fontSize: 10, color: "#ac5140", fontWeight: 500 }}>{message}</span> : null;
}

/** Shared create/edit form. `onSubmit` receives the full payload; for edits the caller diffs against the original. */
export function EventForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: EventDetails; submitLabel: string; onSubmit: (payload: EventPayload) => Promise<void>; onCancel: () => void }) {
  const { t, apiError } = useT();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((c) => ({ ...c, [key]: value }));
    setErrors((c) => ({ ...c, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (form.title.trim().length < 3) next.title = t("events.form.errTitle");
    if (form.venue.trim().length < 2) next.venue = t("events.form.errVenue");
    const startsAt = fromLocalInput(form.startsAt);
    if (!startsAt) next.startsAt = t("events.form.errStartsAt");
    const capacity = Number(form.capacity);
    if (!/^\d+$/.test(form.capacity.trim()) || capacity > 100_000) next.capacity = t("events.form.errCapacity");
    const memberPricePaise = rupeesToPaise(form.memberPrice);
    if (memberPricePaise === null) next.memberPrice = t("events.form.errMemberPrice");
    const guestPricePaise = rupeesToPaise(form.guestPrice);
    if (guestPricePaise === null) next.guestPrice = t("events.form.errGuestPrice");
    const fundraiserGoalPaise = rupeesToPaise(form.fundraiserGoal);
    if (fundraiserGoalPaise === null) next.fundraiserGoal = "Enter a nonnegative rupee amount. Use 0 for no target.";
    setErrors(next);
    if (Object.keys(next).length || !startsAt || memberPricePaise === null || guestPricePaise === null || fundraiserGoalPaise === null) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ title: form.title.trim(), description: form.description.trim(), startsAt, venue: form.venue.trim(), capacity, memberPricePaise, guestPricePaise, fundraiserGoalPaise, status: form.status });
    } catch (caught) {
      if (caught instanceof ApiError && caught.details.length) {
        setErrors(Object.fromEntries(caught.details.map((d) => [FIELD_MAP[d.field] ?? d.field, d.message])));
      }
      setError(apiError(caught, "events.form.saveFailed"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="task-form-grid">
        <label>
          {t("col.title")}
          <input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={140} autoFocus disabled={busy} aria-invalid={Boolean(errors.title)} />
          <FieldError message={errors.title} />
        </label>
        <label>
          {t("col.venue")}
          <input value={form.venue} onChange={(e) => update("venue", e.target.value)} maxLength={200} disabled={busy} aria-invalid={Boolean(errors.venue)} />
          <FieldError message={errors.venue} />
        </label>
        <label>
          {t("events.form.startsAt")}
          <input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.startsAt)} />
          <FieldError message={errors.startsAt} />
        </label>
        <label>
          {t("events.form.capacity")}
          <input type="number" min={0} max={100000} inputMode="numeric" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.capacity)} />
          {errors.capacity ? <FieldError message={errors.capacity} /> : initial ? <span className="subtext">{t("events.form.capacityHint")}</span> : null}
        </label>
        <label>
          {t("events.form.memberPrice")}
          <input inputMode="decimal" placeholder={t("events.form.freePlaceholder")} value={form.memberPrice} onChange={(e) => update("memberPrice", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.memberPrice)} />
          {errors.memberPrice ? <FieldError message={errors.memberPrice} /> : <span className="subtext">{t("events.form.memberPriceHint")}</span>}
        </label>
        <label>
          {t("events.form.guestPrice")}
          <input inputMode="decimal" placeholder={t("events.form.freePlaceholder")} value={form.guestPrice} onChange={(e) => update("guestPrice", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.guestPrice)} />
          {errors.guestPrice ? <FieldError message={errors.guestPrice} /> : <span className="subtext">{t("events.form.guestPriceHint")}</span>}
        </label>
        <label>
          {t("col.status")}
          <select value={form.status} onChange={(e) => update("status", e.target.value as EventStatus)} disabled={busy}>
            <option value="draft">{t("status.draft")}</option>
            <option value="published">{t("status.published")}</option>
            <option value="cancelled">{t("status.cancelled")}</option>
          </select>
          {errors.status ? <FieldError message={errors.status} /> : <span className="subtext">{t("events.form.statusHint")}</span>}
        </label>
        <label>
          Fundraising target (₹)
          <input inputMode="decimal" value={form.fundraiserGoal} onChange={(e) => update("fundraiserGoal", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.fundraiserGoal)} />
          {errors.fundraiserGoal ? <FieldError message={errors.fundraiserGoal} /> : <span className="subtext">Use 0 when this event has no fundraising target.</span>}
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          {t("col.description")}
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={2000} rows={3} disabled={busy} />
          {errors.description ? <FieldError message={errors.description} /> : <span className="subtext">{t("events.form.descriptionHint")}</span>}
        </label>
      </div>
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
        <Button onClick={onCancel} disabled={busy}>{t("action.cancel")}</Button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
