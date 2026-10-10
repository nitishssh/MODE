import { NextResponse } from "next/server";
import { isAllowedCorsOrigin as isAllowedOrigin } from "@/lib/cors";

const allowedMethods = ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"];
const allowedHeaders = ["content-type", "authorization"];

/** Development browser access only. Authentication and CSRF remain in the routes. */
export function proxy(request: Request) {
  if (process.env.NODE_ENV !== "development") return NextResponse.next();

  const origin = request.headers.get("origin");
  const requestedMethod = request.headers.get("access-control-request-method");
  const preflight = request.method === "OPTIONS" && requestedMethod !== null;
  const allowed = isAllowedOrigin(origin);
  const vary = "Origin, Access-Control-Request-Method, Access-Control-Request-Headers";

  if (preflight) {
    const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
      .split(",").map(header => header.trim().toLowerCase()).filter(Boolean);
    if (!allowed || !allowedMethods.includes(requestedMethod) || requestedHeaders.some(header => !allowedHeaders.includes(header))) {
      return new NextResponse(null, { status: 403, headers: { Vary: vary, "Cache-Control": "no-store" } });
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": allowedMethods.join(", "),
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-store",
        Vary: vary,
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Vary", "Origin");
  if (allowed) response.headers.set("Access-Control-Allow-Origin", origin);
  // No Allow-Credentials: browser cookies are for the same-origin web app.
  return response;
}

export const config = { matcher: "/api/:path*" };
