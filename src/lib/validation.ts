import { ZodError, type ZodType } from "zod";
import { ValidationError } from "./errors";

/** Parse with a Zod schema and surface failures as the domain `ValidationError` (HTTP 400). */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw toValidationError(parsed.error);
}

export function toValidationError(error: ZodError): ValidationError {
  return new ValidationError(
    "Please check the submitted fields.",
    error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
  );
}
