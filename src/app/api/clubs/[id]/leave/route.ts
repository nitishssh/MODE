import { getDatabase } from "../../../../../lib/database";
import { json, route } from "../../../../../lib/http";
import { requireActor } from "../../../../../lib/auth/authorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LeaveParams {
  id: string;
}

/** Current person leaves a club (soft-delete via left_at timestamp). */
export const POST = route<LeaveParams>(
  "club leave",
  async (request: Request, params: LeaveParams) => {
    const db = getDatabase();
    const actor = requireActor(request, db, { mutation: true });
    db.leaveClub(actor, params.id);
    return json({ ok: true });
  },
);

