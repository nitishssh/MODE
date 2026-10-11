/** Trusted deployment configuration; never infer an accepted origin from forwarding headers. */
export function configuredPublicOrigin(): string | null {
  const value = process.env.MODE_PUBLIC_ORIGIN?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && url.origin === value) return value;
  } catch { /* Invalid deployment configuration must fail closed. */ }
  throw new Error("MODE_PUBLIC_ORIGIN must be an exact HTTP(S) origin without credentials, path, query or fragment.");
}
