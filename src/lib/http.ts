import { ZodError, type ZodType } from "zod";
import { DomainError, ValidationError } from "./errors";
import { toValidationError } from "./validation";

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
  if (!parsed.success) throw toValidationError(parsed.error);
  return parsed.data;
}

export function errorResponse(error: unknown, context: string): Response {
  if (error instanceof ZodError) error = toValidationError(error);
  if (error instanceof DomainError) {
    return json(
      { error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) },
      { status: error.status },
    );
  }
  console.error(`MODE ${context} failed`, error);
  return json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (request: Request, params: P) => Promise<Response> | Response;

/** Wrap a route handler so domain errors map to status codes and nothing internal leaks. */
export function route<P = Record<string, never>>(context: string, handler: Handler<P>) {
  return async (request: Request, routeContext?: RouteContext<P>): Promise<Response> => {
    try {
      const params = routeContext ? await routeContext.params : ({} as P);
      return await handler(request, params);
    } catch (error) {
      return errorResponse(error, context);
    }
  };
}
