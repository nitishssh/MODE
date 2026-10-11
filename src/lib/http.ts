import type { ZodType } from "zod";
import { DomainError, ValidationError } from "./errors";
import { correlateResponse, logRequest, requestIdFor } from "./request-diagnostics";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
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

export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status },
    );
  }
  return json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (request: Request, params: P) => Promise<Response> | Response;

/** Wrap a route handler so domain errors map to status codes and nothing internal leaks. */
export function route<P = Record<string, never>>(context: string, handler: Handler<P>) {
  return async (request: Request, routeContext?: RouteContext<P>): Promise<Response> => {
    const requestId = requestIdFor(request);
    const started = performance.now();
    let response: Response;
    try {
      const params = routeContext ? await routeContext.params : ({} as P);
      response = await handler(request, params);
    } catch (error) {
      response = errorResponse(error);
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
