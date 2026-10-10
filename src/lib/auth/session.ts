import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "mode_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only a hash of the token is stored, so a database copy does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string, expiresAt: string, request: Request): string {
  // A hosting proxy terminates TLS and forwards plain HTTP; trusting the header here only
  // ever adds Secure, so a spoofed value cannot weaken the cookie.
  const https =
    new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const secure = https ? "; Secure" : "";
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
