import { randomBytes } from "node:crypto";
import { ConflictError } from "../errors";

/** Crockford base32: no I, L, O, U, so codes survive handwriting and shouting across a door. */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SHORT_CODE_LENGTH = 10;
export const TOKEN_COLLISION_MAX_ATTEMPTS = 5;

/** 128 bits of randomness, base64url, 22 characters, for QR codes. */
export function generateQrToken(bytes: () => Buffer = () => randomBytes(16)): string {
  return bytes().toString("base64url");
}

/** 10 Crockford base32 characters, 50 bits, typed by hand at the door. */
export function generateShortCode(bytes: () => Buffer = () => randomBytes(SHORT_CODE_LENGTH)): string {
  const raw = bytes();
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i += 1) code += CROCKFORD[raw[i] % CROCKFORD.length];
  return code;
}

/** Accept user-typed codes leniently: case, hyphens, and the classic O/0, I/L/1 confusions. */
export function normalizeShortCode(input: string): string {
  return input.toUpperCase().replace(/[-\s]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export interface MemberTokens {
  qrToken: string;
  shortCode: string;
}

/**
 * Allocate a token pair that `exists` does not already know. Retries are bounded so a
 * broken random source or a saturated code space fails loudly instead of looping.
 */
export function allocateUniqueTokens(
  exists: (tokens: MemberTokens) => boolean,
  options: { maxAttempts?: number; generate?: () => MemberTokens } = {},
): MemberTokens {
  const maxAttempts = options.maxAttempts ?? TOKEN_COLLISION_MAX_ATTEMPTS;
  const generate = options.generate ?? (() => ({ qrToken: generateQrToken(), shortCode: generateShortCode() }));
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generate();
    if (!exists(candidate)) return candidate;
  }
  throw new ConflictError(`Could not allocate a unique member token after ${maxAttempts} attempts.`, "token_collision");
}
