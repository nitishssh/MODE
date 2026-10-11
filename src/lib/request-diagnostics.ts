import { randomUUID } from "node:crypto";

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Only a UUID may be carried into logs; arbitrary header content is discarded. */
export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && REQUEST_ID.test(supplied) ? supplied.toLowerCase() : randomUUID();
}

export interface RequestLog {
  event: "http_request";
  requestId: string;
  operation: string;
  method: string;
  status: number;
  durationMs: number;
  outcome: "success" | "client_error" | "server_error";
}

/** Operation must be a static route label. Never pass URLs, bodies or errors here. */
export function logRequest(record: RequestLog): void {
  try {
    const line = JSON.stringify(record);
    if (record.status >= 500) console.error(line);
    else console.info(line);
  } catch {
    // An unavailable log sink must not turn a committed operation into a retry.
  }
}

export function correlateResponse(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  // Redirect/fetch responses can have immutable headers; preserve their body and status.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
