import { getDatabase } from "../../../../../lib/database";
import { optionalActor } from "../../../../../lib/auth/authorize";
import { DEFAULT_CLUB_ID } from "../../../../../lib/db/migrations";
import { json, readJson, route } from "../../../../../lib/http";
import { guestBookingSchema } from "../../../../../lib/modules/events";
import { assertSameOrigin } from "../../../../../lib/mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guest booking by name and email; no account. Returns the ticket and its /t/{qrToken} link. */
export const POST = route<{ id: string }>("guest booking", async (request, { id }) => {
  assertSameOrigin(request);
  const db = getDatabase();
  const input = await readJson(request, guestBookingSchema);
  const ticket = db.events.bookGuestTicket(DEFAULT_CLUB_ID, id, input, optionalActor(request, db));
  return json({ ticket, url: `/t/${ticket.qrToken}` }, { status: 201 });
});
