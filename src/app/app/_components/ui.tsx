"use client";

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { amount, countdown, dateTime, money, titleCase } from "../_lib/format";
import { describeError } from "../_lib/api";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "default" | "primary" | "accent" | "danger" | "ghost";

export function Button({ variant = "default", size, loading, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm"; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} className={`mx-btn ${variant === "default" ? "" : variant} ${size ?? ""} ${className}`.trim()}>
      {loading ? <span className="mx-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "default", size, children, className = "" }: { href: string; variant?: Variant; size?: "sm"; children: ReactNode; className?: string }) {
  return <Link href={href} className={`mx-btn ${variant === "default" ? "" : variant} ${size ?? ""} ${className}`.trim()}>{children}</Link>;
}

// ── Page & cards ─────────────────────────────────────────────────────────────

export function PageHead({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mx-page-head">
      <div>
        {eyebrow ? <p className="mx-eyebrow">{eyebrow}</p> : null}
        <h1 className="mx-h1" style={{ marginTop: eyebrow ? 6 : 0 }}>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="mx-page-actions">{actions}</div> : null}
    </header>
  );
}

export function Card({ title, actions, children, className = "", tone }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; tone?: "ink" | "flat" | "tight" }) {
  return (
    <section className={`mx-card ${tone === "ink" ? "mx-card-ink" : tone === "flat" ? "mx-card-flat" : tone === "tight" ? "mx-card-tight" : ""} ${className}`.trim()}>
      {title || actions ? (
        <div className="mx-card-head">
          {title ? <h2 className="mx-h3">{title}</h2> : <span />}
          {actions ? <div className="mx-row">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "accent" | "green" | "blue" | "amber" }) {
  return (
    <article className={`mx-stat ${tone ? `tone-${tone}` : ""}`.trim()}>
      <p className="mx-eyebrow">{label}</p>
      <p className="mx-stat-value">{value}</p>
      {hint ? <p className="mx-stat-hint">{hint}</p> : null}
    </article>
  );
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export function Alert({ tone = "info", children, onRetry, onDismiss }: { tone?: "error" | "success" | "info" | "warning"; children: ReactNode; onRetry?: () => void; onDismiss?: () => void }) {
  const I = tone === "error" ? Icon.warning : tone === "success" ? Icon.check : Icon.info;
  return (
    <div className={`mx-alert ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <I style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
      {onRetry ? <Button size="sm" onClick={onRetry}>Retry</Button> : null}
      {onDismiss ? <button type="button" className="mx-iconbtn" style={{ width: 26, height: 26, border: 0, background: "transparent" }} aria-label="Dismiss" onClick={onDismiss}><Icon.close /></button> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, fallback }: { error: unknown; onRetry?: () => void; fallback?: string }) {
  return <Alert tone="error" onRetry={onRetry}>{describeError(error, fallback)}</Alert>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="mx-loading" role="status" aria-live="polite"><span className="mx-spinner" aria-hidden="true" />{label}</div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <span key={i} className="mx-skel" style={{ width: `${90 - (i % 3) * 18}%` }} />)}
    </div>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "accent" | "ink";

const STATUS_TONES: Record<string, Tone> = {
  active: "green", expired: "red", none: "neutral", guest: "blue",
  paid: "green", pending_payment: "amber", cancelled: "neutral", fulfilled: "blue",
  published: "green", draft: "amber",
  todo: "neutral", in_progress: "blue", done: "green",
  submitted: "amber", approved: "blue", rejected: "red",
  income: "green", expense: "red", expense_paid: "red",
  admin: "ink", organizer: "accent", treasurer: "blue", volunteer: "green", member: "neutral",
  simulated: "blue", unpaid: "amber",
};

export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`mx-badge ${tone === "neutral" ? "" : tone}`.trim()}>{dot ? <i /> : null}{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>{label ?? titleCase(status)}</Badge>;
}

// ── Forms ────────────────────────────────────────────────────────────────────

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="mx-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="mx-error" role="alert">{error}</span> : hint ? <span className="mx-hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ className = "", invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} aria-invalid={invalid || undefined} className={`mx-input ${className}`.trim()} />;
}

export function Select({ className = "", invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select {...rest} aria-invalid={invalid || undefined} className={`mx-select ${className}`.trim()}>{children}</select>;
}

export function Textarea({ className = "", invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} aria-invalid={invalid || undefined} className={`mx-textarea ${className}`.trim()} />;
}

/** Label + input in one, with a generated id so the label is wired for accessibility. */
export function TextField({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} htmlFor={id}><Input id={id} invalid={Boolean(error)} {...rest} /></Field>;
}

export function SelectField({ label, hint, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} htmlFor={id}><Select id={id} invalid={Boolean(error)} {...rest}>{children}</Select></Field>;
}

export function TextareaField({ label, hint, error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} htmlFor={id}><Textarea id={id} invalid={Boolean(error)} {...rest} /></Field>;
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, title, onClose, children, wide, description }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean; description?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="mx-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`mx-modal ${wide ? "wide" : ""}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-modal-head">
          <div>
            <h2 className="mx-h2">{title}</h2>
            {description ? <p className="mx-muted" style={{ marginTop: 4 }}>{description}</p> : null}
          </div>
          <button type="button" className="mx-iconbtn" aria-label="Close" onClick={onClose}><Icon.close /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tabs & segmented ─────────────────────────────────────────────────────────

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="mx-tabs" role="tablist">
      {items.map((item) => (
        <button key={item.value} type="button" role="tab" aria-selected={item.value === value} className={`mx-tab ${item.value === value ? "active" : ""}`.trim()} onClick={() => onChange(item.value)}>
          {item.label}{typeof item.count === "number" ? <span className="mx-muted"> · {item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="mx-seg" role="group">
      {items.map((item) => <button key={item.value} type="button" className={item.value === value ? "active" : ""} aria-pressed={item.value === value} onClick={() => onChange(item.value)}>{item.label}</button>)}
    </div>
  );
}

// ── Data display ─────────────────────────────────────────────────────────────

export function Table({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="mx-table-wrap">
      <table className="mx-table">
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <div style={{ padding: 16 }}>{empty}</div> : null}
    </div>
  );
}

export function Money({ paise, whole, exact }: { paise: number | null | undefined; whole?: boolean; exact?: boolean }) {
  return <span className="mx-num">{exact ? amount(paise) : money(paise, { whole })}</span>;
}

export function When({ iso }: { iso: string | null | undefined }) {
  return <time dateTime={iso ?? undefined}>{dateTime(iso)}</time>;
}

export function KeyValue({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="mx-kv">
      {items.map((item, i) => <div key={i} style={{ display: "contents" }}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  );
}

/** Live "mm:ss" until a hold expires. Renders "expired" once passed and calls onExpire once. */
export function Countdown({ until, onExpire }: { until: string | null | undefined; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  const left = countdown(until, now);
  useEffect(() => {
    if (until && !left && !fired) { setFired(true); onExpire?.(); }
  }, [until, left, fired, onExpire]);
  if (!until) return null;
  return <span className="mx-countdown">{left || "expired"}</span>;
}

export function Progress({ value, tone }: { value: number; tone?: "accent" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <div className={`mx-progress ${tone ?? ""}`.trim()} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${clamped}%` }} /></div>;
}

/** Permission-gated wrapper: renders nothing when the viewer lacks it. */
export function Can({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? <>{children}</> : null;
}
