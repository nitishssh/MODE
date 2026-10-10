import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { MemberPass, SessionUser } from "@/src/contracts";
import { ApiError, login as loginRequest, logout as logoutRequest, me } from "@/src/lib/api";

type Session = { user: SessionUser | null; pass: MemberPass | null; loading: boolean; error: string | null; refresh(): Promise<void>; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void> };
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null); const [pass, setPass] = useState<MemberPass | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = async () => { try { const next = await me(); setUser(next.user); setPass(next.pass); setError(null); } catch (reason) { setUser(null); setPass(null); if (!(reason instanceof ApiError && reason.status === 401)) setError("Unable to restore your session."); } };
  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);
  const value = useMemo(() => ({ user, pass, loading, error, refresh, signIn: async (email: string, password: string) => { setError(null); await loginRequest(email, password); await refresh(); }, signOut: async () => { await logoutRequest(); setUser(null); setPass(null); } }), [user, pass, loading, error]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() { const session = useContext(SessionContext); if (!session) throw new Error("SessionProvider is required."); return session; }
