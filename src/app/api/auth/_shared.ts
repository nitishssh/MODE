import { ROLE_PERMISSIONS } from "../../../lib/auth/permissions";
import { sessionCookie } from "../../../lib/auth/session";
import type { AuthResponse, Member, SessionUser } from "../../../lib/contracts";
import { json } from "../../../lib/http";
import type { Actor, IssuedSession } from "../../../lib/modules/identity";

export function toSessionUser(source: Actor | (Member & { clubId: string })): SessionUser {
  const id = "memberId" in source ? source.memberId : source.id;
  return {
    id,
    name: source.name,
    email: source.email,
    role: source.role,
    clubId: source.clubId,
    permissions: [...ROLE_PERMISSIONS[source.role]],
  };
}

export function sessionResponse(request: Request, issued: IssuedSession, clubId: string, status: number): Response {
  const body: AuthResponse = { user: toSessionUser({ ...issued.member, clubId }), expiresAt: issued.expiresAt };
  return json(body, { status, headers: { "Set-Cookie": sessionCookie(issued.token, issued.expiresAt, request) } });
}
