import { ForbiddenError } from "./errors";
import { configuredPublicOrigin } from "./auth/public-origin";

/**
 * Cookie sessions need a same-origin check on every state-changing request so a
 * third-party page cannot ride a signed-in browser. Authentication itself lives
 * in `auth/authorize.ts`; this guard only answers "did this request come from us?".
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  const publicOrigin = configuredPublicOrigin();
  let expectedOrigin = publicOrigin ?? requestUrl.origin;
  if (host !== null) {
    // Next.js can normalize request.url to localhost even when the browser uses
    // 127.0.0.1. The direct HTTP Host retains the actual requested authority.
    // An explicitly configured public origin handles TLS termination or a rewritten
    // internal Host. Forwarded / X-Forwarded-* headers cannot grant an origin.
    if (host.length === 0 || /[\\/\s@?#,]/.test(host)) {
      throw new ForbiddenError("Invalid request host.");
    }
    try {
      const directOrigin = new URL(`${requestUrl.protocol}//${host}`).origin;
      if (!publicOrigin) expectedOrigin = directOrigin;
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
