import type { ZodType } from "zod";
import { randomUUID } from "node:crypto";
import { DomainError, ValidationError } from "./errors";
import { correlateResponse, logRequest, requestIdFor } from "./request-diagnostics";
import { type AdmissionPriority, withHttpAdmission } from "./traffic-control";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", NO_STORE["Cache-Control"]);
  return Response.json(data, { ...init, headers });
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("The request must contain valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      "Please check the submitted fields.",
      parsed.error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
    );
  }
  return parsed.data;
}

/** Logs only the error class: messages and stacks can carry secrets or personal data. */
function reportUnexpectedError(error: unknown, context: string, requestId: string): void {
  try {
    console.error(JSON.stringify({
      level: "error",
      event: "route_exception",
      context,
      requestId,
      errorName: error instanceof Error ? error.name : typeof error,
    }));
  } catch {
    // An unavailable log sink must not change the response.
  }
}

/** Inside route() the request log already records the failure, so it passes report: false. */
export function errorResponse(error: unknown, context = "unlabelled route", requestId: string = randomUUID(), { report = true } = {}): Response {
  let response: Response;
  if (error instanceof DomainError) {
    if (report && error.internalCause !== undefined) reportUnexpectedError(error.internalCause, context, requestId);
    response = json(
      { error: error.message, code: error.code, requestId, ...(error.details ? { details: error.details } : {}) },
      { status: error.status, headers: error.headers },
    );
  } else {
    if (report) reportUnexpectedError(error, context, requestId);
    response = json(
      { error: "Something went wrong. Please try again.", code: "internal_error", requestId },
      { status: 500 },
    );
  }
  response.headers.set("X-Request-Id", requestId);
  return response;
}

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (request: Request, params: P) => Promise<Response> | Response;
interface RouteOptions {
  admission?: AdmissionPriority;
}

/** Wrap a route handler so domain errors map to status codes and nothing internal leaks. */
export function route<P = Record<string, never>>(context: string, handler: Handler<P>, options: RouteOptions = {}) {
  return async (request: Request, routeContext?: RouteContext<P>): Promise<Response> => {
    const requestId = requestIdFor(request);
    const started = performance.now();
    let response: Response;
    try {
      const params = routeContext ? await routeContext.params : ({} as P);
      response = await withHttpAdmission(options.admission ?? "normal", () => handler(request, params));
    } catch (error) {
      response = errorResponse(error, context, requestId, { report: false });
    }
    logRequest({
      event: "http_request",
      requestId,
      operation: context,
      method: request.method,
      status: response.status,
      durationMs: Math.round(Math.max(0, performance.now() - started) * 100) / 100,
      outcome: response.status >= 500 ? "server_error" : response.status >= 400 ? "client_error" : "success",
    });
    return correlateResponse(response, requestId);
  };
}
