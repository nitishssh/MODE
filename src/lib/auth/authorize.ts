import type { ClubDatabase } from "../database";
import { UnauthorizedError } from "../errors";
import { assertSameOrigin } from "../mutation-guard";
import { assertPermission, type Actor } from "../modules/identity";
import { readSessionToken } from "./session";
import type { Permission } from "./permissions";

export interface AuthorizeOptions {
  /** Required permission; omitted means "any signed-in member". */
  permission?: Permission;
  /** State-changing cookie request: also enforce the same-origin check. */
  mutation?: boolean;
}

/**
 * Resolve the caller or throw: 401 when there is no valid session, 403 when the
 * role lacks the permission or the request is cross-origin.
 */
export function requireActor(
  request: Request,
  db: Pick<ClubDatabase, "getActor">,
  options: AuthorizeOptions = {},
): Actor {
  const actor = optionalActor(request, db);
  if (!actor) throw new UnauthorizedError();
  // A bearer must resolve successfully before it can bypass cookie CSRF checks.
  if (options.mutation && !request.headers.has("authorization")) assertSameOrigin(request);
  if (options.permission) assertPermission(actor, options.permission);
  return actor;
}

/** Optional identity for public reads that reveal more to signed-in officers. */
export function optionalActor(request: Request, db: Pick<ClubDatabase, "getActor">): Actor | null {
  const actor = db.getActor(readSessionToken(request));
  if (request.headers.has("authorization") && !actor) throw new UnauthorizedError();
  return actor;
}
