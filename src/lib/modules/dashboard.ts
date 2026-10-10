import type { Announcement, Dashboard, Event, Product, Task, Transaction } from "../contracts";
import { DEFAULT_CLUB_ID } from "../db/migrations";
import { clubDate, int, text, type DbContext, type Row } from "../db/core";
import { MEMBERSHIP_ACTIVE_SQL } from "./membership-state";
import { hasPermission } from "../auth/permissions";
import type { Actor, IdentityModule } from "./identity";

export function createDashboardModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;

  /**
   * Public club overview. Member emails and finance are included only when the
   * caller holds the matching permission; the shape stays stable for the UI.
   */
  function getDashboard(actor: Actor | null = null): Dashboard {
    const clubId = actor?.clubId ?? DEFAULT_CLUB_ID;
    const timestamp = ctx.now().toISOString();
    const canSeeMembers = actor !== null && hasPermission(actor.role, "members:read");
    const canSeeFinance = actor !== null && hasPermission(actor.role, "ledger:read");
    const members = identity.getMembers(clubId);
    const club = db.prepare("SELECT name, description FROM clubs WHERE id = ?").get(clubId) as Row | undefined;

    const events: Event[] = (db.prepare("SELECT * FROM events WHERE club_id = ? ORDER BY starts_at, id").all(clubId) as Row[]).map((row) => ({
      id: text(row.id),
      title: text(row.title),
      startsAt: text(row.starts_at),
      venue: text(row.venue),
      capacity: int(row.capacity),
      registered: int(row.registered),
      memberPricePaise: int(row.member_price_paise),
      guestPricePaise: int(row.guest_price_paise),
    }));
    const announcements: Announcement[] = (
      db.prepare("SELECT * FROM announcements WHERE club_id = ? ORDER BY published_at DESC, id").all(clubId) as Row[]
    ).map((row) => ({
      id: text(row.id),
      title: text(row.title),
      body: text(row.body),
      publishedAt: text(row.published_at),
    }));
    const products: Product[] = (db.prepare("SELECT * FROM products WHERE club_id = ? ORDER BY name, id").all(clubId) as Row[]).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      pricePaise: int(row.price_paise),
      stock: int(row.stock),
    }));
    const tasks: Task[] = (db.prepare("SELECT * FROM tasks WHERE club_id = ? ORDER BY id").all(clubId) as Row[]).map((row) => ({
      id: text(row.id),
      title: text(row.title),
      assignee: text(row.assignee),
      status: row.status as Task["status"],
    }));
    const transactions: Transaction[] = (
      db.prepare("SELECT * FROM transactions WHERE club_id = ? ORDER BY occurred_at DESC, id").all(clubId) as Row[]
    ).map((row) => ({
      id: text(row.id),
      description: text(row.description),
      kind: row.kind as Transaction["kind"],
      amountPaise: int(row.amount_paise),
      occurredAt: text(row.occurred_at),
    }));
    const balance = db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE -amount_paise END), 0) AS balance FROM transactions WHERE club_id = ?",
      )
      .get(clubId) as Row | undefined;

    return {
      club: {
        name: club ? text(club.name) : "Sample Student Club",
        description: club ? text(club.description) : "",
      },
      metrics: {
        members: members.length,
        activeMembers: int(
          (db.prepare(`SELECT COUNT(*) AS n FROM members WHERE club_id = ? AND ${MEMBERSHIP_ACTIVE_SQL}`).get(clubId, clubDate(ctx.now())) as Row).n,
        ),
        upcomingEvents: events.filter((event) => event.startsAt >= timestamp).length,
        balancePaise: canSeeFinance ? int(balance?.balance ?? 0) : 0,
      },
      members: canSeeMembers ? members : [],
      events,
      announcements,
      products,
      tasks: actor ? tasks : [],
      transactions: canSeeFinance ? transactions : [],
      access: { members: canSeeMembers, finance: canSeeFinance },
    };
  }

  return { getDashboard };
}
