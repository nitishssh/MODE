import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, isAllowedCorsOrigin } from "@/lib/cors";

/**
 * Cross-origin API access is opt-in. Normal same-origin browser requests have
 * no Origin header and continue straight to their route handlers.
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin === null) return NextResponse.next();

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
