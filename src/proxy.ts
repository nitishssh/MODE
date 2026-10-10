import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, isAllowedCorsOrigin } from "@/lib/cors";
import { assertSameOrigin } from "@/lib/mutation-guard";

/**
 * Cross-origin reads are opt-in. Cookie mutations retain the route-level
 * same-origin guard, independently of the CORS allowlist.
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin === null) return NextResponse.next();
  try {
    assertSameOrigin(request);
    return NextResponse.next();
  } catch {
    // Cross-origin requests must match the explicit read/preflight allowlist.
  }

  if (!isAllowedCorsOrigin(origin)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403, headers: { Vary: "Origin" } });
  }

  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export const config = { matcher: "/api/:path*" };
