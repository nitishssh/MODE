import { ForbiddenError } from "./errors";

/**
 * Cookie sessions need a same-origin check on every state-changing request so a
 * third-party page cannot ride a signed-in browser. Authentication itself lives
 * in `auth/authorize.ts`; this guard only answers "did this request come from us?".
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  let expectedOrigin = requestUrl.origin;
  if (host !== null) {
    // Next.js can normalize request.url to localhost even when the browser uses
    // 127.0.0.1. The direct HTTP Host retains the actual requested authority.
    // Forwarded / X-Forwarded-* headers are deliberately ignored.
    if (host.length === 0 || /[\\/\s@?#,]/.test(host)) {
      throw new ForbiddenError("Invalid request host.");
    }
    try {
      expectedOrigin = new URL(`${requestUrl.protocol}//${host}`).origin;
    } catch {
      throw new ForbiddenError("Invalid request host.");
    }
  }
  if ((origin !== null && origin !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ForbiddenError("Cross-origin writes are not allowed.");
  }
}

/** Response-returning form kept for the starter's tests and simple handlers. */
export function rejectUnsafeMutation(request: Request): Response | null {
  try {
    assertSameOrigin(request);
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return Response.json({ error: error.message }, { status: 403 });
    throw error;
  }
}
