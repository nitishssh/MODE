import type { CursorPage } from "../generated/contracts";
import { message, SessionChangedError } from "./session-client";
import { MAX_PAGE_LIMIT } from "./list-query";

export function readCursorPage<T extends { id: string }>(value: unknown, limit: number, currentCursor: string | null): CursorPage<T> {
  const page = value as CursorPage<T> | null;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT || !page || !Array.isArray(page.items) ||
    page.items.length > limit || typeof page.hasMore !== "boolean" ||
    (page.nextCursor !== null && (typeof page.nextCursor !== "string" || !/^[A-Za-z0-9._~-]{1,4096}$/.test(page.nextCursor))) ||
    page.hasMore !== (page.nextCursor !== null) ||
    (page.hasMore && (!page.items.length || page.nextCursor === currentCursor)) ||
    page.items.some(item => !item || typeof item.id !== "string" || !item.id) ||
    new Set(page.items.map(item => item.id)).size !== page.items.length) {
    throw new Error("The server returned an invalid page. Retry or restart from the first page.");
  }
  return page;
}

export type PageState<T> = { data: CursorPage<T> | null; loading: boolean; error: string | null; time: Date | null };

/** A loader belongs to one query and one session; late responses never publish. */
export class PageLoader<T extends { id: string }> {
  private state: PageState<T>;
  private listeners = new Set<() => void>();
  private sequence = 0;
  private active = true;
  constructor(
    private request: () => Promise<unknown>,
    private limit: number,
    private cursor: string | null,
    private isCurrent: () => boolean,
    enabled = true,
  ) {
    this.state = { data: null, loading: enabled, error: null, time: null };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: Partial<PageState<T>>) {
    this.state = { ...this.state, ...state };
    this.listeners.forEach(listener => listener());
  }
  activate = () => { this.active = true; };
  dispose = () => { this.active = false; this.sequence++; };
  load = async () => {
    if (!this.active || !this.isCurrent()) return;
    const sequence = ++this.sequence;
    const current = () => this.active && sequence === this.sequence && this.isCurrent();
    this.publish({ loading: true, error: null });
    try {
      const value = await this.request();
      if (current()) this.publish({ data: readCursorPage<T>(value, this.limit, this.cursor), time: new Date() });
    } catch (error) {
      if (current() && !(error instanceof SessionChangedError)) this.publish({ error: message(error) });
    } finally {
      if (current()) this.publish({ loading: false });
    }
  };
}
