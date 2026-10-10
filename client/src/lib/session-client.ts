import type {
  AuthResponse,
  AuthMeResponse,
  SessionUser,
} from "../generated/contracts";
export interface TokenStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}
export type MeResponse = AuthMeResponse;
export type SessionState = {
  status: "loading" | "signedOut" | "signedIn" | "unavailable";
  user: SessionUser | null;
  busy: boolean;
  error: string | null;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class SessionChangedError extends Error {
  constructor() {
    super("The session changed. Please retry.");
  }
}
type Options = {
  platform: "web" | "native";
  baseUrl?: string;
  store: TokenStore;
  fetch?: typeof fetch;
};
function sessionUser(value: unknown): SessionUser {
  const user = value as SessionUser | null;
  if (
    !user ||
    typeof user.id !== "string" ||
    typeof user.name !== "string" ||
    typeof user.email !== "string" ||
    typeof user.clubId !== "string" ||
    !["member", "volunteer", "organizer", "treasurer", "admin"].includes(
      user.role,
    ) ||
    !Array.isArray(user.permissions) ||
    !user.permissions.every((p) => typeof p === "string")
  )
    throw new Error("The server returned an invalid session. Please retry.");
  return user;
}

/** One session generation owns every request. Old responses cannot revive/clear a new login. */
export class SessionClient {
  private state: SessionState = {
    status: "loading",
    user: null,
    busy: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private token: string | null = null;
  private generation = 0;
  private clearing: Promise<void> | null = null;
  private boot: Promise<void> | null = null;
  private storageQueue: Promise<unknown> = Promise.resolve();
  constructor(private options: Options) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private set(state: Partial<SessionState>) {
    this.state = { ...this.state, ...state };
    this.listeners.forEach((fn) => fn());
  }
  private storage<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.storageQueue.then(operation);
    this.storageQueue = result.catch(() => {});
    return result;
  }
  private async raw(
    path: string,
    init: RequestInit = {},
    binary = false,
  ): Promise<unknown> {
    if (!path.startsWith("/api/"))
      throw new Error("API requests must stay under /api/.");
    const native = this.options.platform === "native";
    let base = "";
    if (native) {
      let url: URL;
      try {
        url = new URL(this.options.baseUrl ?? "");
      } catch {
        throw new Error(
          "Set EXPO_PUBLIC_API_URL to the API address reachable by this device.",
        );
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error(
          "EXPO_PUBLIC_API_URL must be an http(s) origin without credentials, path or query.",
        );
      base = url.origin;
    }
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    headers.delete("Authorization");
    if (native && this.token)
      headers.set("Authorization", `Bearer ${this.token}`);
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await (this.options.fetch ?? fetch)(`${base}${path}`, {
        ...init,
        headers,
        credentials: native ? "omit" : "same-origin",
        cache: "no-store",
        signal: init.signal ?? controller.signal,
      });
    } catch {
      throw new Error(
        "Could not reach MODE. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (binary && response.ok) return response.blob();
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof body?.error === "string"
          ? body.error
          : "Request failed. Please try again.",
      );
    if (response.status !== 204 && body === null)
      throw new Error(
        "The server returned an unreadable response. Please retry.",
      );
    return body;
  }
  private async expire() {
    this.generation++;
    this.token = null;
    this.set({
      status: "signedOut",
      user: null,
      busy: true,
      error: "Your session ended. Please sign in again.",
    });
    this.clearing = this.storage(() => this.options.store.clear());
    try {
      await this.clearing;
    } catch {
      this.set({
        error:
          "Session ended, but secure storage could not be cleared. Retry sign out before sharing this device.",
      });
    } finally {
      this.clearing = null;
      this.set({ busy: false });
    }
  }
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const generation = this.generation;
    try {
      const result = await this.raw(path, init);
      if (generation !== this.generation) throw new SessionChangedError();
      return result as T;
    } catch (error) {
      if (
        generation === this.generation &&
        error instanceof ApiError &&
        error.status === 401
      )
        await this.expire();
      throw error;
    }
  }
  async download(path: string): Promise<Blob> {
    const generation = this.generation;
    try {
      const blob = (await this.raw(path, {}, true)) as Blob;
      if (generation !== this.generation) throw new SessionChangedError();
      return blob;
    } catch (error) {
      if (
        generation === this.generation &&
        error instanceof ApiError &&
        error.status === 401
      )
        await this.expire();
      throw error;
    }
  }
  bootstrap() {
    if (this.boot) return this.boot;
    this.boot = this.restore().finally(() => {
      this.boot = null;
    });
    return this.boot;
  }
  private async restore() {
    if (this.state.busy) return;
    let generation = this.generation;
    // Returning from the native camera/document picker must not unmount drafts.
    // A failed/revoked session still clears the authenticated tree below.
    if (!this.state.user)
      this.set({ status: "loading", user: null, error: null });
    try {
      if (this.options.platform === "native") {
        const restored = await this.storage(() => this.options.store.read());
        if (generation !== this.generation) return;
        if (restored !== this.token) {
          generation = ++this.generation;
          if (this.state.user) this.set({ status: "loading", user: null });
        }
        this.token = restored;
        if (!this.token) {
          this.set({ status: "signedOut", user: null });
          return;
        }
      }
      const result = await this.request<MeResponse>("/api/auth/me");
      if (generation === this.generation)
        this.set({ status: "signedIn", user: sessionUser(result.user), error: null });
    } catch (error) {
      if (generation === this.generation)
        this.set(this.state.user
          ? { status: "signedIn", error: `Could not revalidate the session. Cached data may be stale. ${message(error)}` }
          : { status: "unavailable", user: null, error: message(error) });
    }
  }
  async signIn(email: string, password: string) {
    return this.authenticate("/api/auth/login", {
      email: email.trim(),
      password,
    });
  }
  async signUp(name: string, email: string, password: string) {
    return this.authenticate("/api/auth/register", {
      name: name.trim(),
      email: email.trim(),
      password,
    });
  }
  private async authenticate(path: string, input: Record<string, string>) {
    if (this.state.busy) return;
    if (this.clearing) await this.clearing.catch(() => {});
    const generation = ++this.generation;
    this.set({ busy: true, error: null });
    // Never send a previous native credential with a new login.
    this.token = null;
    try {
      const result = (await this.raw(path, {
        method: "POST",
        body: JSON.stringify(input),
      })) as AuthResponse;
      const user = sessionUser(result?.user);
      if (this.options.platform === "native") {
        if (
          typeof result.token !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(result.token)
        )
          throw new Error("The server returned an invalid session token.");
        await this.storage(() => this.options.store.write(result.token));
        this.token = result.token;
      }
      if (generation === this.generation)
        this.set({ status: "signedIn", user });
    } catch (error) {
      if (generation === this.generation)
        this.set({ status: "signedOut", user: null, error: message(error) });
    } finally {
      if (generation === this.generation) this.set({ busy: false });
    }
  }
  async signOut() {
    if (this.state.busy) return;
    const generation = this.generation;
    this.set({ busy: true, error: null });
    try {
      await this.request("/api/auth/logout", { method: "POST" });
      if (generation !== this.generation) return;
      await this.storage(() => this.options.store.clear());
      if (generation !== this.generation) return;
      this.generation++;
      this.token = null;
      this.set({ status: "signedOut", user: null, busy: false });
    } catch (error) {
      if (generation === this.generation)
        this.set({ error: `Sign out did not complete. ${message(error)}` });
    } finally {
      if (generation === this.generation) this.set({ busy: false });
    }
  }
}
export function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
