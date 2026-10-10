/** Parses MODE_CORS_ORIGINS without allowing paths, wildcard origins, or malformed values. */
export function parseCorsOrigins(value = process.env.MODE_CORS_ORIGINS): Set<string> {
  const origins = new Set<string>();
  for (const rawOrigin of (value ?? "").split(",")) {
    const candidate = rawOrigin.trim();
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) continue;
      origins.add(url.origin);
    } catch {
      // Invalid configuration never becomes a permissive origin.
    }
  }
  return origins;
}

export function isAllowedCorsOrigin(origin: string | null, configured = process.env.MODE_CORS_ORIGINS): origin is string {
  return origin !== null && parseCorsOrigins(configured).has(origin);
}
