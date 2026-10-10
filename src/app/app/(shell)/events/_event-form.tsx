"use client";

import { useState, type FormEvent } from "react";
import type { EventDetails, EventStatus } from "@/lib/contracts";
import { ApiError, describeError } from "../../_lib/api";
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
  status: EventStatus;
};

type Form = { title: string; description: string; startsAt: string; venue: string; capacity: string; memberPrice: string; guestPrice: string; status: EventStatus };
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
    status: event?.status ?? "published",
  };
}

const FIELD_MAP: Record<string, keyof Form> = { title: "title", description: "description", startsAt: "startsAt", venue: "venue", capacity: "capacity", memberPricePaise: "memberPrice", guestPricePaise: "guestPrice", status: "status" };

function FieldError({ message }: { message?: string }) {
  return message ? <span className="error-text" role="alert" style={{ fontSize: 10, color: "#ac5140", fontWeight: 500 }}>{message}</span> : null;
}

/** Shared create/edit form. `onSubmit` receives the full payload; for edits the caller diffs against the original. */
export function EventForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: EventDetails; submitLabel: string; onSubmit: (payload: EventPayload) => Promise<void>; onCancel: () => void }) {
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
    if (form.title.trim().length < 3) next.title = "Title needs at least 3 characters.";
    if (form.venue.trim().length < 2) next.venue = "Enter the venue.";
    const startsAt = fromLocalInput(form.startsAt);
    if (!startsAt) next.startsAt = "Pick a date and time.";
    const capacity = Number(form.capacity);
    if (!/^\d+$/.test(form.capacity.trim()) || capacity > 100_000) next.capacity = "Enter a whole number of seats (0–100,000).";
    const memberPricePaise = rupeesToPaise(form.memberPrice);
    if (memberPricePaise === null) next.memberPrice = "Enter a rupee amount, e.g. 50 or 49.50.";
    const guestPricePaise = rupeesToPaise(form.guestPrice);
    if (guestPricePaise === null) next.guestPrice = "Enter a rupee amount, e.g. 100.";
    setErrors(next);
    if (Object.keys(next).length || !startsAt || memberPricePaise === null || guestPricePaise === null) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit({ title: form.title.trim(), description: form.description.trim(), startsAt, venue: form.venue.trim(), capacity, memberPricePaise, guestPricePaise, status: form.status });
    } catch (caught) {
      if (caught instanceof ApiError && caught.details.length) {
        setErrors(Object.fromEntries(caught.details.map((d) => [FIELD_MAP[d.field] ?? d.field, d.message])));
      }
      setError(describeError(caught, "The event could not be saved."));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="task-form-grid">
        <label>
          Title
          <input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={140} autoFocus disabled={busy} aria-invalid={Boolean(errors.title)} />
          <FieldError message={errors.title} />
        </label>
        <label>
          Venue
          <input value={form.venue} onChange={(e) => update("venue", e.target.value)} maxLength={200} disabled={busy} aria-invalid={Boolean(errors.venue)} />
          <FieldError message={errors.venue} />
        </label>
        <label>
          Starts at
          <input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.startsAt)} />
          <FieldError message={errors.startsAt} />
        </label>
        <label>
          Capacity (seats)
          <input type="number" min={0} max={100000} inputMode="numeric" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.capacity)} />
          {errors.capacity ? <FieldError message={errors.capacity} /> : initial ? <span className="subtext">Cannot go below seats already held or sold.</span> : null}
        </label>
        <label>
          Member price (₹)
          <input inputMode="decimal" placeholder="0 for free" value={form.memberPrice} onChange={(e) => update("memberPrice", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.memberPrice)} />
          {errors.memberPrice ? <FieldError message={errors.memberPrice} /> : <span className="subtext">Charged to members with active dues.</span>}
        </label>
        <label>
          Guest price (₹)
          <input inputMode="decimal" placeholder="0 for free" value={form.guestPrice} onChange={(e) => update("guestPrice", e.target.value)} disabled={busy} aria-invalid={Boolean(errors.guestPrice)} />
          {errors.guestPrice ? <FieldError message={errors.guestPrice} /> : <span className="subtext">Everyone else, including expired members.</span>}
        </label>
        <label>
          Status
          <select value={form.status} onChange={(e) => update("status", e.target.value as EventStatus)} disabled={busy}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {errors.status ? <FieldError message={errors.status} /> : <span className="subtext">Only published events accept bookings.</span>}
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Description
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} maxLength={2000} rows={3} disabled={busy} />
          {errors.description ? <FieldError message={errors.description} /> : <span className="subtext">Plain text, shown to members and guests.</span>}
        </label>
      </div>
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  );
}
