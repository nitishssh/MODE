import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { clubDate } from "../src/lib/db/core";
import { MEMBERSHIP_ACTIVE_SQL, MEMBERSHIP_STATE_SQL, membershipState } from "../src/lib/modules/membership-state";

// Healthy-contract acceptance: execute both SQL expressions at the IST boundary;
// the existing P0 test inspects SQL text and seeded states without this exact matrix.
test("membership SQL and JS agree for yesterday, today, tomorrow and null across IST midnight", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE members (expires_on TEXT)");
    for (const instant of ["2026-10-09T18:29:59Z", "2026-10-09T18:30:00Z", "2026-10-10T18:30:00Z"]) {
      const today = clubDate(new Date(instant));
      for (const expiresOn of [null, "2026-10-09", "2026-10-10", "2026-10-11"]) {
        db.exec("DELETE FROM members");
        db.prepare("INSERT INTO members VALUES (?)").run(expiresOn);
        const row = db.prepare(`SELECT ${MEMBERSHIP_STATE_SQL} AS state, ${MEMBERSHIP_ACTIVE_SQL} AS active FROM members`).get(today, today)!;
        const expected = membershipState({ expiresOn }, today);
        assert.equal(row.state, expected, `${instant}: ${expiresOn}`);
        assert.equal(row.active, expected === "active" ? 1 : 0);
      }
    }
  } finally { db.close(); }
});
