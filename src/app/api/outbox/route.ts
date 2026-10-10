import { z } from "zod";
import { requireActor } from "../../../lib/auth/authorize";
import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";
import { mailTransport } from "../../../lib/modules/outbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const filterSchema = z.object({
  kind: z.string().min(1).max(60).optional(),
  status: z.enum(["pending", "previewed", "sent", "failed"]).optional(),
});

/** Officer view of queued and attempted deliveries. Recipients are masked. */
export const GET = route("outbox list", (request) => {
  const db = getDatabase();
  const actor = requireActor(request, db, { permission: "outbox:manage" });
  const url = new URL(request.url);
  const filter = filterSchema.parse({
    kind: url.searchParams.get("kind") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  return json({
    transport: mailTransport(),
    pending: db.outbox.countPending(actor.clubId),
    messages: db.outbox.list(actor, filter),
  });
});
