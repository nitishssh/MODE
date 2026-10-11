import type { SqlDatabase } from "../db/core";
import { DEMO_MEMBERS, DEMO_OFFICERS, PUBLIC_DEMO_PASSWORD } from "../db/migrations";
import { verifyPassword } from "./password";

/** Check persisted synthetic credentials even when every migration has already run. */
export function assertSafeDemoPasswords(db: SqlDatabase): void {
  if (process.env.NODE_ENV !== "production") return;
  // Credentials live on the person (v14); memberships only point at them.
  const lookup = db.prepare("SELECT p.password_hash FROM members m JOIN people p ON p.id = m.person_id WHERE m.id = ?");
  for (const { id } of [...DEMO_OFFICERS, ...DEMO_MEMBERS]) {
    const hash = lookup.get(id)?.password_hash;
    if (typeof hash === "string" && verifyPassword(PUBLIC_DEMO_PASSWORD, hash)) {
      throw new Error(
        "Production database refused: a seeded account still uses the public demo password. " +
        "Rotate all synthetic account passwords in private maintenance before hosting. " +
        "Changing MODE_DEMO_PASSWORD or MODE_SEED does not update existing credentials.",
      );
    }
  }
}
