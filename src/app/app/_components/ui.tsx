"use client";

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import ShinyButton from "@/components/ui/shiny-button";
import { Icon, type IconName } from "./icons";
import { amount, countdown, dateTime, money, titleCase } from "../_lib/format";
import { describeError } from "../_lib/api";

/*
 * Every component here renders the legacy workspace's own markup and class
 * names (panel, panel-heading, metric-card, button primary, badge, empty,
 * loading-state, task-form-grid, treasury-tabs, table-scroll…) so the new
 * pages look identical to Azman's screens.
 */

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "default" | "primary" | "accent" | "danger" | "ghost" | "green" | "red";

function buttonClass(variant: Variant, size?: "sm", className = "") {
  if (size === "sm") {
    const tone = variant === "danger" || variant === "red" ? "red-btn" : variant === "primary" || variant === "accent" || variant === "green" ? "green-btn" : "";
    return `button-small ${tone} ${className}`.trim();
  }
  if (variant === "ghost") return `text-button ${className}`.trim();
  if (variant === "danger" || variant === "red") return `button danger ${className}`.trim();
  if (variant === "default") return `button secondary ${className}`.trim();
  return `button primary ${className}`.trim();
}

/** `primary`/`accent` render Azman's terracotta shiny pill; `sm` renders his `.button-small` chips. */
export function Button({ variant = "default", size, loading, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm"; loading?: boolean }) {
  const cls = buttonClass(variant, size, className);
  const content = <>{loading ? <span className="loader" aria-hidden="true" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}{children}</>;
  if (!size && (variant === "primary" || variant === "accent")) {
    return <ShinyButton {...rest} disabled={rest.disabled || loading} className={cls}>{content}</ShinyButton>;
  }
  return <button type="button" {...rest} disabled={rest.disabled || loading} className={cls}>{content}</button>;
}

export function LinkButton({ href, variant = "default", size, children, className = "", target }: { href: string; variant?: Variant; size?: "sm"; children: ReactNode; className?: string; target?: string }) {
  return <Link href={href} target={target} className={buttonClass(variant, size, className)}>{children}</Link>;
}

/** The legacy "text-button" with the trailing arrow, used in panel headings. */
export function TextLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const inner = <>{children}<Icon name="arrow" size={16} /></>;
  if (href) return <Link href={href} className="text-button">{inner}</Link>;
  return <button type="button" className="text-button" onClick={onClick}>{inner}</button>;
}

// ── Page & panels ────────────────────────────────────────────────────────────

/** `.page-heading`: eyebrow "CLUB / SECTION", serif h1, muted description, optional action on the right. */
export function PageHead({ eyebrow, title, titleAccent, description, actions }: { eyebrow?: ReactNode; title: ReactNode; titleAccent?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}{titleAccent ? <> <span>{titleAccent}</span></> : null}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="mx-row">{actions}</div> : null}
    </div>
  );
}

/** `.panel` with the legacy `.panel-heading` (kicker + serif title + text-button action). */
export function Card({ title, kicker, actions, children, className = "", flush, action }: { title?: ReactNode; kicker?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; /** No body padding: for tables and lists that run edge to edge. */ flush?: boolean; action?: { label: ReactNode; href?: string; onClick?: () => void } }) {
  const hasHead = title || kicker || actions || action;
  return (
    <section className={`panel ${className}`.trim()}>
      {hasHead ? (
        <div className="panel-heading">
          <div>
            {kicker ? <div className="eyebrow">{kicker}</div> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="mx-row">{actions}</div> : action ? <TextLink href={action.href} onClick={action.onClick}>{action.label}</TextLink> : null}
        </div>
      ) : null}
      <div className={`panel-body ${flush ? "flush" : ""}`.trim()}>{children}</div>
    </section>
  );
}

/** A `.panel.task-create-panel` inline form with the `.form-heading` and close button, like the legacy "Add member" / "New task" panels. */
export function FormPanel({ title, description, onClose, children, id }: { title: ReactNode; description?: ReactNode; onClose?: () => void; children: ReactNode; id?: string }) {
  const headingId = useId();
  return (
    <section className="panel task-create-panel" aria-labelledby={id ?? headingId}>
      <div className="form-heading">
        <div>
          <h2 id={id ?? headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {onClose ? <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button> : null}
      </div>
      {children}
    </section>
  );
}

const METRIC_COLORS = { blue: "lavender", accent: "peach", green: "mint", amber: "peach", dark: "dark" } as const;

/** `.metric-card` with the coloured icon chip; `tone="dark"` is the ink card used for money. */
export function Stat({ label, value, hint, tone = "blue", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof METRIC_COLORS; icon?: IconName }) {
  const color = METRIC_COLORS[tone];
  const iconName: IconName = icon ?? (tone === "dark" ? "wallet" : tone === "green" ? "check" : tone === "accent" ? "calendar" : "people");
  return (
    <article className={`metric-card ${color === "dark" ? "metric-dark" : ""}`.trim()}>
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${color}`}><Icon name={iconName} size={18} /></span>
      </div>
      <strong className="metric-value">{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export function Alert({ tone = "info", children, onRetry, onDismiss }: { tone?: "error" | "success" | "info" | "warning"; children: ReactNode; onRetry?: () => void; onDismiss?: () => void }) {
  if (tone === "success") {
    return <div className="success-message" role="status"><Icon name="check" size={18} /><span style={{ flex: 1 }}>{children}</span>{onDismiss ? <button type="button" className="text-button" onClick={onDismiss}>Dismiss</button> : null}</div>;
  }
  if (tone === "error") {
    return <div className="error-inline" role="alert"><span>{children}</span>{onRetry ? <button className="text-button" type="button" onClick={onRetry}>Retry</button> : onDismiss ? <button className="text-button" type="button" onClick={onDismiss}>Dismiss</button> : null}</div>;
  }
  return (
    <div className="outstanding-notice" role="status">
      <div className="mx-row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><Icon name={tone === "warning" ? "alert" : "coin"} size={16} /><div>{children}</div></div>
      {onRetry ? <button className="text-button" type="button" onClick={onRetry}>Retry</button> : onDismiss ? <button className="text-button" type="button" onClick={onDismiss}>Dismiss</button> : null}
    </div>
  );
}

/** Full `.error-state` block for a page that could not load. */
export function ErrorState({ error, onRetry, fallback, title = "Something did not load" }: { error: unknown; onRetry?: () => void; fallback?: string; title?: string }) {
  return (
    <div className="error-state" role="alert">
      <h2>{title}</h2>
      <p>{describeError(error, fallback)}</p>
      {onRetry ? <Button variant="primary" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

export function EmptyState({ title, children, action, icon = "grid" }: { title: string; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loader" /><span>{label}</span></div>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-stack-sm" aria-busy="true" aria-label="Loading" style={{ padding: "4px 0" }}>
      {Array.from({ length: rows }, (_, i) => <span key={i} className="skeleton" style={{ width: `${90 - (i % 3) * 18}%`, height: 14 }} />)}
    </div>
  );
}

// ── Badges ───────────────────────────────────────────────────────────────────

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "accent" | "ink" | "purple";

const TONE_CLASS: Record<Tone, string> = { neutral: "neutral", green: "green", amber: "amber", red: "red", blue: "purple", purple: "purple", accent: "red", ink: "neutral" };

const STATUS_TONES: Record<string, Tone> = {
  active: "green", expired: "red", none: "neutral", guest: "purple",
  paid: "green", pending_payment: "amber", cancelled: "neutral", fulfilled: "purple",
  published: "green", draft: "amber",
  todo: "neutral", in_progress: "purple", done: "green",
  submitted: "amber", approved: "purple", rejected: "red",
  income: "green", expense: "red", expense_paid: "red",
  admin: "red", organizer: "amber", treasurer: "purple", volunteer: "green", member: "neutral",
  simulated: "purple", unpaid: "amber",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{label ?? titleCase(status)}</Badge>;
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
        <div className="form-heading">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tabs & segmented ─────────────────────────────────────────────────────────

/** The legacy treasury pill tabs. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="treasury-tabs" role="tablist">
      {items.map((item) => (
        <button key={item.value} type="button" role="tab" aria-selected={item.value === value} className={`treasury-tab ${item.value === value ? "active" : ""}`.trim()} onClick={() => onChange(item.value)}>
          {item.label}{typeof item.count === "number" ? <span style={{ opacity: .7 }}> · {item.count}</span> : null}
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

/** `.table-scroll > table` with the legacy th/td styling. Put it inside a flush Card. */
export function Table({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <div>{empty}</div> : null}
    </div>
  );
}

/** Avatar + name + subtext cell, like the member directory. */
export function Person({ name, sub, small }: { name: string; sub?: ReactNode; small?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <div className="person">
      <span className={`avatar ${small ? "small" : ""}`.trim()}>{initials}</span>
      <span><strong>{name}</strong>{sub ? <span className="subtext">{sub}</span> : null}</span>
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

/** The legacy `.capacity-bar`. */
export function Progress({ value, tone }: { value: number; tone?: "accent" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return <div className={`capacity-bar ${tone ? "mx-progress accent" : ""}`.trim()} style={{ marginTop: 0 }} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${clamped}%` }} /></div>;
}

/** The legacy footnote strip under a panel. */
export function PreviewNote({ children }: { children: ReactNode }) {
  return <div className="preview-note"><span className="badge neutral">Note</span><p>{children}</p></div>;
}

/** Permission-gated wrapper: renders nothing when the viewer lacks it. */
export function Can({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? <>{children}</> : null;
}
