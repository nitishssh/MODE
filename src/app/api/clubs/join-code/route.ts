import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import type { ClubJoinCode } from "../../../../lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The active club's join code (club leads only). */
export const GET = route("club join code", (request) => {
  const db = getDatabase();
  return json(db.getJoinCode(requireActor(request, db)) satisfies ClubJoinCode);
});

/** Issue a new join code; the previous one stops working immediately. */
export const POST = route("club join code rotate", (request) => {
  const db = getDatabase();
  return json(db.rotateJoinCode(requireActor(request, db, { mutation: true })) satisfies ClubJoinCode);
});

/** Switch joining by code off. */
export const DELETE = route("club join code disable", (request) => {
  const db = getDatabase();
  return json(db.disableJoinCode(requireActor(request, db, { mutation: true })) satisfies ClubJoinCode);
});
