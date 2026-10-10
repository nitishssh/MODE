import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { AuthResponse, SessionUser } from "@/src/contracts";

const TOKEN_KEY = "mode.session-token";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const baseUrl = configuredApiUrl ?? "http://127.0.0.1:3000";
const isWeb = Platform.OS === "web";

export class ApiError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
async function nativeToken() { return isWeb ? null : SecureStore.getItemAsync(TOKEN_KEY); }
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await nativeToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init, credentials: isWeb ? "include" : "omit",
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.error ?? "Request failed. Please try again.", body.code);
  return body as T;
}
export async function login(email: string, password: string) {
  const auth = await request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!isWeb) await SecureStore.setItemAsync(TOKEN_KEY, auth.token);
  return auth.user;
}
export async function logout() { try { await request<{ ok: true }>("/api/auth/logout", { method: "POST" }); } finally { if (!isWeb) await SecureStore.deleteItemAsync(TOKEN_KEY); } }
export async function me(): Promise<{ user: SessionUser; pass: import("@/src/contracts").MemberPass }> { return request("/api/auth/me"); }
