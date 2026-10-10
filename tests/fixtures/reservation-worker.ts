import { openClubDatabase } from "../../src/lib/database";
import { FIXED_NOW, actorFor } from "../helpers";

const [path, kind, id, email] = process.argv.slice(2);
const db = openClubDatabase(path, { now: () => FIXED_NOW });
const actor = actorFor(db, email);
process.once("message", () => {
  let result: { status: string; code?: string };
  try {
    if (kind === "expense") db.payExpense(actor, id, "SIMULTANEOUS-PAYMENT");
    else if (kind === "ticket") db.events.bookTicket(actor, id);
    else db.merchandise.createOrder(actor, { variantId: id });
    result = { status: "reserved" };
  } catch (error) {
    result = { status: "rejected", code: error instanceof Error && "code" in error ? String(error.code) : "unexpected" };
  } finally { db.close(); }
  process.send!(result, () => process.disconnect());
});
process.send!({ status: "ready" });
