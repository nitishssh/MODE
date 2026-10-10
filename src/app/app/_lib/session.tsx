"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthMeResponse, MemberPass, SessionUser } from "@/lib/contracts";
import { api, ApiError } from "./api";

export type Permission =
  | "roles:manage" | "members:create" | "members:read" | "membership:record_payment" | "membership:reminders"
  | "events:write" | "events:report" | "tickets:check_in" | "bookings:create" | "payments:confirm"
  | "products:write" | "orders:create" | "orders:fulfil" | "ledger:read" | "expenses:submit" | "expenses:review"
  | "announcements:write" | "outbox:manage" | "tasks:write";

type Status = "loading" | "anonymous" | "authenticated";

export interface Session {
  status: Status;
  user: SessionUser | null;
  pass: MemberPass | null;
  /** Drive navigation and actions from permissions, never from role names. */
  can: (permission: Permission) => boolean;
  /** Re-fetch /api/auth/me (after dues renewal, role change, etc.). */
  refresh: () => Promise<void>;
  /** Apply a fresh session locally (after login/register) without a round trip. */
  setSession: (next: AuthMeResponse | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export const LOGIN_PATH = "/app/login";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        const next = await api.get<AuthMeResponse>("/api/auth/me");
        setMe(next);
        setStatus("authenticated");
      } catch (caught) {
        if (caught instanceof ApiError && caught.unauthenticated) {
          setMe(null);
          setStatus("anonymous");
        } else if (!me) {
          // Network or server failure with no session yet: treat as anonymous so the login page can show.
          setMe(null);
          setStatus("anonymous");
        }
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setSession = useCallback((next: AuthMeResponse | null) => {
    setMe(next);
    setStatus(next ? "authenticated" : "anonymous");
  }, []);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setMe(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<Session>(() => ({
    status,
    user: me?.user ?? null,
    pass: me?.pass ?? null,
    can: (permission) => me?.user.permissions.includes(permission) ?? false,
    refresh,
    setSession,
    logout,
  }), [status, me, refresh, setSession, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}

/** Convenience for pages that know they are inside the authenticated shell. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error("useUser called outside an authenticated page.");
  return user;
}

/** Redirects anonymous visitors to the login page, remembering where they were going. */
export function useRequireSession() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.status === "anonymous") {
      const next = pathname && pathname !== LOGIN_PATH ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`${LOGIN_PATH}${next}`);
    }
  }, [session.status, router, pathname]);
  return session;
}

/** When an action fails with 401, drop the session so the shell redirects. */
export function useSessionGuard() {
  const { setSession } = useSession();
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && error.unauthenticated) setSession(null);
  }, [setSession]);
}
