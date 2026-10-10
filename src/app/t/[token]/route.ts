import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guest ticket link: the holder's view, resolved by the random QR token only. */
export const GET = route<{ token: string }>("public ticket", (_request, { token }) => {
  return json({ ticket: getDatabase().events.publicTicket(token) });
});
