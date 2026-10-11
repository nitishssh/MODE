"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Typed error for any non-2xx API answer. `code` is the stable server field; `message` is readable. */
export class ApiError extends Error {
  status: number;
  code: string | null;
  details: { field: string; message: string }[];
  retryAfterSeconds: number | null;
  requestId: string | null;

  constructor(status: number, message: string, code: string | null = null, details: { field: string; message: string }[] = [], retryAfterSeconds: number | null = null, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.requestId = requestId;
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
  rate_limited: "Too many requests. Waiting briefly before trying again.",
  server_busy: "The server is busy. Please try again shortly.",
  request_timeout: "The server took too long to respond. Please try again.",
  network_error: "Could not reach MODE. Check your connection and try again.",
  unknown_outcome: "The connection was lost. The operation may have completed; refresh before trying again.",
  invalid_response: "The server returned an unreadable response. Please try again.",
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

const REQUEST_TIMEOUT_MS = 15_000;

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : null;
}

function waitBeforeRetry(attempt: number, retryAfterSeconds: number | null): Promise<void> {
  const serverDelay = (retryAfterSeconds ?? 0) * 1000;
  const backoff = 250 * 2 ** attempt;
  const delay = Math.min(2_000, Math.max(serverDelay, backoff)) + Math.random() * 250;
  return new Promise((resolve) => globalThis.setTimeout(resolve, delay));
}

async function request<T>(method: string, path: string, body?: Json | FormData): Promise<T> {
  const init: RequestInit = { method, cache: "no-store", credentials: "same-origin", headers: {} };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const attempts = method === "GET" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(path, { ...init, signal: controller.signal });
    } catch {
      globalThis.clearTimeout(timeout);
      const code = timedOut ? "request_timeout" : method === "GET" ? "network_error" : "unknown_outcome";
      if (method === "GET" && attempt + 1 < attempts) {
        await waitBeforeRetry(attempt, null);
        continue;
      }
      throw new ApiError(0, CODE_MESSAGES[code], code);
    } finally {
      globalThis.clearTimeout(timeout);
    }
    const text = await response.text();
    let parsed: unknown = null;
    let readable = true;
    if (text) {
      try { parsed = JSON.parse(text); } catch { readable = false; }
    }
    const requestId = response.headers.get("x-request-id");
    if (response.ok) {
      if (!readable) throw new ApiError(502, CODE_MESSAGES.invalid_response, "invalid_response", [], null, requestId);
      return parsed as T;
    }

    const payload = (parsed ?? {}) as { error?: string; code?: string; requestId?: string; details?: { field: string; message: string }[] };
    const code = typeof payload.code === "string" ? payload.code : response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : null;
    const message = typeof payload.error === "string" ? payload.error : `Request failed (${response.status}).`;
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    const retryableRead = method === "GET" && (response.status === 429 || response.status === 503) && attempt + 1 < attempts;
    if (retryableRead) {
      await waitBeforeRetry(attempt, retryAfterSeconds);
      continue;
    }
    throw new ApiError(response.status, message, code, Array.isArray(payload.details) ? payload.details : [], retryAfterSeconds, requestId ?? (typeof payload.requestId === "string" ? payload.requestId : null));
  }
  throw new ApiError(503, "The server is busy. Please try again shortly.", "server_busy");
}

// Coalesce identical reads that overlap during navigation/chrome refreshes. This
// is deliberately not a response cache: the entry disappears when the request settles.
const inflightReads = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  const current = inflightReads.get(path) as Promise<T> | undefined;
  if (current) return current;
  const pending = request<T>("GET", path);
  inflightReads.set(path, pending);
  void pending.finally(() => {
    if (inflightReads.get(path) === pending) inflightReads.delete(path);
  }).catch(() => { /* the original caller receives the rejection */ });
  return pending;
}

export const api = {
  get,
  post: <T>(path: string, body?: Json | FormData) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: Json) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: Json) => request<T>("PUT", path, body),
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
 * Load data for a page. Reloads whenever an item in `deps` changes (compared with Object.is).
 * Stale completions never overwrite a newer request.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const ticket = useRef(0);
  const latestLoad = useRef(load);
  useLayoutEffect(() => { latestLoad.current = load; });

  // Compare deps during render so the hook dependency lists below stay array literals.
  const [seenDeps, setSeenDeps] = useState(deps);
  const [generation, setGeneration] = useState(0);
  if (!sameDeps(seenDeps, deps)) {
    setSeenDeps(deps);
    setGeneration((value) => value + 1);
    setLoading(true);
  }

  const fetchLatest = useCallback(() => {
    const current = ++ticket.current;
    return latestLoad.current().then(
      (result) => {
        if (current !== ticket.current) return;
        setData(result);
        setError(null);
        setLoading(false);
      },
      (caught: unknown) => {
        if (current !== ticket.current) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => { void fetchLatest(); }, [fetchLatest, generation]);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchLatest();
  }, [fetchLatest]);

  const set = useCallback<Loadable<T>["setData"]>((updater) => {
    setData((current) => (typeof updater === "function" ? (updater as (c: T | null) => T | null)(current) : updater));
  }, []);

  return { data, error, loading, reload, setData: set };
}

function sameDeps(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
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
