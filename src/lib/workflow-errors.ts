import { ConflictError } from "./errors";

/** A valid resource was found but its requested state transition is not allowed. */
export class InvalidTransitionError extends ConflictError {
  constructor(message: string) {
    super(message, "invalid_transition");
  }
}
