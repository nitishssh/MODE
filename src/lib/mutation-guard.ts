/** The starter has no authentication. Writes are a local-demo-only capability. */
export function rejectUnsafeMutation(request: Request): Response | null {
  if (process.env.NODE_ENV === "production" && process.env.MODE_ENABLE_DEMO_WRITES !== "true") {
    return Response.json(
      { error: "Demo writes are disabled in production. Enable them only for a trusted local demo." },
      { status: 403 },
    );
  }
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  let expectedOrigin = requestUrl.origin;
  if (host !== null) {
    // Next.js can normalize request.url to localhost even when the browser uses
    // 127.0.0.1. The direct HTTP Host retains the actual requested authority.
    // Do not trust Forwarded / X-Forwarded-* for this local-only starter.
    if (host.length === 0 || /[\\/\s@?#,]/.test(host)) {
      return Response.json({ error: "Invalid request host." }, { status: 403 });
    }
    try {
      expectedOrigin = new URL(`${requestUrl.protocol}//${host}`).origin;
    } catch {
      return Response.json({ error: "Invalid request host." }, { status: 403 });
    }
  }
  if (
    (origin !== null && origin !== expectedOrigin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return Response.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  }
  return null;
}
