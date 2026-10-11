import { createHash } from "node:crypto";
import { MAX_SESSION_TOKEN_LENGTH } from "./jwt";
import { configuredPublicOrigin } from "./public-origin";
export { SESSION_TTL_MS } from "./jwt";

export const SESSION_COOKIE = "mode_session";

/** Only a hash of the token is stored, so a database copy does not leak live sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(request: Request): string | null {
  // The presence of Authorization selects bearer authentication, even when
  // malformed. Never fall back to an ambient browser cookie.
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    if (authorization.length > MAX_SESSION_TOKEN_LENGTH + 7) return null;
    return /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization)?.[1] ?? null;
  }
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      try {
        const token = decodeURIComponent(rest.join("="));
        return token.length <= MAX_SESSION_TOKEN_LENGTH ? token : null;
      }
      catch { return null; }
    }
  }
  return null;
}

export function sessionCookie(token: string, expiresAt: string, request: Request): string {
  // A hosting proxy terminates TLS and forwards plain HTTP; trusting the header here only
  // ever adds Secure, so a spoofed value cannot weaken the cookie.
  const https =
    configuredPublicOrigin()?.startsWith("https:") === true ||
    new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const secure = https ? "; Secure" : "";
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
