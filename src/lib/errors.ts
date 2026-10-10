/** Domain errors carry the HTTP status the API layer should return. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Array<{ field: string; message: string }>) {
    super(message, 400, "validation_failed", details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Sign in to continue.") {
    super(message, 401, "unauthenticated");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You are not allowed to perform this action.") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "The requested record was not found.") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = "conflict") {
    super(message, 409, code);
  }
}

/** Kept for compatibility with the starter's member tests. */
export class DuplicateMemberError extends ConflictError {
  constructor() {
    super("A member with this email address already exists.", "duplicate_member");
  }
}

/** Login throttling (audit #10): the account is locked for a short window after repeated failures. */
export class TooManyAttemptsError extends DomainError {
  constructor(readonly lockedUntil: string) {
    super("Too many sign-in attempts. Try again in a few minutes.", 429, "too_many_attempts");
  }
}
