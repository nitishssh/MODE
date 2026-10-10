import { requireActor } from "../../../../lib/auth/authorize";
import { getDatabase } from "../../../../lib/database";
import { clubDate } from "../../../../lib/db/core";
import { json, route } from "../../../../lib/http";
import { expiringQuerySchema } from "../../../../lib/modules/dues";
import { parseInput } from "../../../../lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Members whose membership ends within the window (default 30 club days). */
export const GET = route("expiring members", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "members:read" });
  const { days } = parseInput(expiringQuerySchema, { days: new URL(request.url).searchParams.get("days") ?? undefined });
  return json({ asOf: clubDate(new Date()), windowDays: days, members: db.dues.expiringWithin(actor, days) });
});
