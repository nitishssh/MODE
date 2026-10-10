import type { ClubDatabase } from "../database";
import { UnauthorizedError } from "../errors";
import { assertSameOrigin } from "../mutation-guard";
import { assertPermission, type Actor } from "../modules/identity";
import { readSessionToken } from "./session";
import type { Permission } from "./permissions";

export interface AuthorizeOptions {
  /** Required permission; omitted means "any signed-in member". */
  permission?: Permission;
  /** State-changing request: also enforce the same-origin check. */
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
  if (options.mutation) assertSameOrigin(request);
  const actor = db.getActor(readSessionToken(request));
  if (!actor) throw new UnauthorizedError();
  if (options.permission) assertPermission(actor, options.permission);
  return actor;
}

/** Optional identity for public reads that reveal more to signed-in officers. */
export function optionalActor(request: Request, db: Pick<ClubDatabase, "getActor">): Actor | null {
  return db.getActor(readSessionToken(request));
}
