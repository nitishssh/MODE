import { createHmac, timingSafeEqual } from "node:crypto";

export const JWT_ISSUER = "mode";
export const JWT_AUDIENCE = "mode-api";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SESSION_TOKEN_LENGTH = 2048;

export interface SessionClaims {
  sub: string;
  jti: string;
  clubId: string;
  iat: number;
  exp: number;
}

/** Server-only secret: no public prefix, default key, or per-process fallback. */
function signingKey(): Buffer {
  const secret = process.env.MODE_JWT_SECRET;
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error("MODE_JWT_SECRET must be 64 hexadecimal characters (32 random bytes). Run npm run auth:setup locally or configure the deployment secret.");
  }
  return Buffer.from(secret, "hex");
}

function encode(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Reject noncanonical base64url and non-object JSON rather than coercing claims. */
function decode(segment: string): Record<string, unknown> | null {
  const bytes = Buffer.from(segment, "base64url");
  if (bytes.toString("base64url") !== segment) return null;
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function signSessionJwt(memberId: string, clubId: string, sessionId: string, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: JWT_ISSUER, aud: JWT_AUDIENCE, sub: memberId, jti: sessionId,
    clubId, iat, exp: iat + SESSION_TTL_MS / 1000,
  });
  const content = `${header}.${payload}`;
  return `${content}.${createHmac("sha256", signingKey()).update(content).digest("base64url")}`;
}

/** Verifies the signature and claims; decoding alone never authenticates a caller. */
export function verifySessionJwt(token: string, now: Date): SessionClaims | null {
  if (token.length > MAX_SESSION_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  // Misconfiguration is a server error, not an invalid-user-token error.
  const key = signingKey();
  try {
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const signature = Buffer.from(signaturePart, "base64url");
    const expected = createHmac("sha256", key).update(`${headerPart}.${payloadPart}`).digest();
    if (signature.length !== expected.length || signature.toString("base64url") !== signaturePart || !timingSafeEqual(signature, expected)) return null;
    const header = decode(headerPart);
    // This is deliberately one fixed JWT profile: no key URLs, algorithm negotiation,
    // critical extensions, or unsigned tokens are accepted.
    if (!header || header.alg !== "HS256" || header.typ !== "JWT" || Object.keys(header).some((name) => name !== "alg" && name !== "typ")) return null;
    const claims = decode(payloadPart);
    if (!claims || claims.iss !== JWT_ISSUER || claims.aud !== JWT_AUDIENCE) return null;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      typeof claims.sub !== "string" || !claims.sub ||
      typeof claims.jti !== "string" || !claims.jti ||
      typeof claims.clubId !== "string" || !claims.clubId ||
      typeof claims.iat !== "number" || !Number.isSafeInteger(claims.iat) ||
      typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp) ||
      claims.iat > nowSeconds || claims.exp <= nowSeconds ||
      claims.exp - claims.iat !== SESSION_TTL_MS / 1000 ||
      (claims.nbf !== undefined && (typeof claims.nbf !== "number" || !Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds))
    ) return null;
    return { sub: claims.sub, jti: claims.jti, clubId: claims.clubId, iat: claims.iat, exp: claims.exp };
  } catch {
    return null;
  }
}
