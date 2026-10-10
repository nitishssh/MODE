"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Typed error for any non-2xx API answer. `code` is the stable server field; `message` is readable. */
export class ApiError extends Error {
  status: number;
  code: string | null;
  details: { field: string; message: string }[];

  constructor(status: number, message: string, code: string | null = null, details: { field: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get unauthenticated() { return this.status === 401; }
  get forbidden() { return this.status === 403; }
  /** First validation message for a given field, when the server returned one. */
  fieldError(field: string): string | undefined {
    return this.details.find((item) => item.field === field)?.message;
  }
}

/** Friendlier copy for the stable error codes documented in docs/API.md. */
const CODE_MESSAGES: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again to continue.",
  forbidden: "Your role does not allow this action.",
  too_many_attempts: "Too many sign-in attempts. Wait 15 minutes and try again.",
  duplicate_ticket: "There is already a live ticket for this event under this name.",
  sold_out: "This event is sold out.",
  event_not_open: "Bookings are not open for this event.",
  event_started: "This event has already started.",
  member_email: "That email belongs to a club member. Sign in to book a member ticket.",
  hold_expired: "The 30-minute hold has expired. Book again to get a fresh hold.",
  refunds_out_of_scope: "Paid items cannot be cancelled: refunds are out of scope.",
  out_of_stock: "That size is out of stock right now.",
  pending_limit: "You already hold the maximum unpaid units for this size. Pay or cancel first.",
  product_inactive: "This product has been retired.",
  order_not_paid: "The order must be paid before it can be handed over.",
  announcement_key_reused: "This draft was already published with different content. Start a fresh announcement.",
};

export function describeError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

type Json = Record<string, unknown> | unknown[] | null;

async function request<T>(method: string, path: string, body?: Json | FormData): Promise<T> {
  const init: RequestInit = { method, cache: "no-store", credentials: "same-origin", headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }
  if (!response.ok) {
    const payload = (parsed ?? {}) as { error?: string; code?: string; details?: { field: string; message: string }[] };
    const code = typeof payload.code === "string" ? payload.code : response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : null;
    const message = typeof payload.error === "string" ? payload.error : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message, code, Array.isArray(payload.details) ? payload.details : []);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Json | FormData) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: Json) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export interface Loadable<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
  /** Re-run the loader. Keeps current data visible while refreshing. */
  reload: () => Promise<void>;
  /** Replace data locally without a round trip (optimistic or post-mutation updates). */
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

/**
 * Load data for a page. `load` must be stable (wrap in useCallback) or pass `deps`.
 * Stale completions never overwrite a newer request.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const ticket = useRef(0);

  const run = useCallback(async () => {
    const current = ++ticket.current;
    setLoading(true);
    try {
      const result = await load();
      if (current !== ticket.current) return;
      setData(result);
      setError(null);
    } catch (caught) {
      if (current !== ticket.current) return;
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      if (current === ticket.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { void run(); }, [run]);

  const set = useCallback<Loadable<T>["setData"]>((updater) => {
    setData((current) => (typeof updater === "function" ? (updater as (c: T | null) => T | null)(current) : updater));
  }, []);

  return { data, error, loading, reload: run, setData: set };
}

/** Small helper for buttons that run one async action and surface its error. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const run = useCallback(async (key: string, work: () => Promise<string | void>) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const message = await work();
      if (message) setNotice(message);
      return true;
    } catch (caught) {
      setError(describeError(caught));
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, error, notice, run, clear: () => { setError(""); setNotice(""); }, setError, setNotice };
}

/** Client-side UUID for idempotent submissions (expenses, announcements). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
