"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { useT } from "../_lib/i18n";

/*
 * Toasts: the third feedback signal after the button's loading state and the
 * row update. Bottom-right (above the phone tab bar), one tone bar per
 * outcome, an optional action (usually Undo), auto-dismiss with a visible
 * lifetime, pause on hover.
 */

export type ToastTone = "ok" | "bad" | "warn" | "info";

export interface ToastInput {
  title: ReactNode;
  body?: ReactNode;
  tone?: ToastTone;
  /** ms before auto-dismiss; 0 keeps it until closed. */
  duration?: number;
  action?: { label: ReactNode; onClick: () => void };
}

interface ToastItem extends ToastInput { id: number; tone: ToastTone; duration: number }

interface ToastApi {
  push: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
  ok: (title: ReactNode, body?: ReactNode, action?: ToastInput["action"]) => number;
  bad: (title: ReactNode, body?: ReactNode) => number;
}

const ToastContext = createContext<ToastApi | null>(null);
const ICONS: Record<ToastTone, IconName> = { ok: "check", bad: "alert", warn: "alert", info: "info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const arm = useCallback((item: ToastItem) => {
    if (item.duration <= 0) return;
    const timer = window.setTimeout(() => dismiss(item.id), item.duration);
    timers.current.set(item.id, timer);
  }, [dismiss]);

  const push = useCallback((toast: ToastInput) => {
    const item: ToastItem = { tone: "info", duration: toast.action ? 7000 : 4200, ...toast, id: ++counter.current };
    setItems((current) => [...current.slice(-3), item]);
    arm(item);
    return item.id;
  }, [arm]);

  const api = useMemo<ToastApi>(() => ({
    push,
    dismiss,
    ok: (title, body, action) => push({ title, body, tone: "ok", action }),
    bad: (title, body) => push({ title, body, tone: "bad", duration: 6500 }),
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} dismiss={dismiss} pause={(id) => { const t = timers.current.get(id); if (t) { window.clearTimeout(t); timers.current.delete(id); } }} resume={(id) => { const item = items.find((i) => i.id === id); if (item && !timers.current.has(id)) arm({ ...item, duration: Math.min(item.duration, 2500) }); }} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, dismiss, pause, resume }: { items: ToastItem[]; dismiss: (id: number) => void; pause: (id: number) => void; resume: (id: number) => void }) {
  const { t } = useT();
  if (!items.length) return null;
  return (
    <div className="mx-toasts" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div key={item.id} className={`mx-toast ${item.tone}`} role="status" onMouseEnter={() => pause(item.id)} onMouseLeave={() => resume(item.id)}>
          <Icon name={ICONS[item.tone]} size={18} />
          <div className="mx-toast-body">
            <strong>{item.title}</strong>
            {item.body ? <span>{item.body}</span> : null}
          </div>
          {item.action ? <button type="button" onClick={() => { item.action?.onClick(); dismiss(item.id); }}>{item.action.label}</button> : null}
          <button type="button" className="close" aria-label={t("action.dismiss")} onClick={() => dismiss(item.id)}><Icon name="close" size={14} /></button>
          {item.duration > 0 ? <span className="mx-toast-life" style={{ animationDuration: `${item.duration}ms` }} aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}

const NOOP: ToastApi = { push: () => 0, dismiss: () => undefined, ok: () => 0, bad: () => 0 };

/** Safe outside the provider (auth pages): calls become no-ops. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}
