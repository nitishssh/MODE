import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/** scrypt with a per-password salt; stored as `scrypt$<salt hex>$<hash hex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// Hash of a random value nobody knows; verifying against it costs the same as a real check.
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) {
    // Spend the same scrypt time for unknown accounts so response time does not reveal them.
    verifyPassword(password, DUMMY_HASH);
    return false;
  }
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
