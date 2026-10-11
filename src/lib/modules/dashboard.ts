import type { Announcement, Dashboard, Event, Product, Task, Transaction, WorkspaceChromeSummary, WorkspaceSearchResult } from "../contracts";
import { DEFAULT_CLUB_ID } from "../db/migrations";
import { clubDate, int, text, type DbContext, type Row } from "../db/core";
import { MEMBERSHIP_ACTIVE_SQL } from "./membership-state";
import { hasPermission } from "../auth/permissions";
import type { Actor, IdentityModule } from "./identity";

export function createDashboardModule(ctx: DbContext, identity: IdentityModule, options: { beforeRead?: () => void } = {}) {
  const { db } = ctx;

  function clubSummary(clubId: string): { name: string; demo: boolean } {
    const club = identity.getClub(clubId);
    return { name: club?.name ?? "Sample Student Club", demo: club?.demo ?? true };
  }

  /** Persistent app chrome needs counts, never whole collections. */
  function getWorkspaceChrome(actor: Actor): WorkspaceChromeSummary {
    const taskCounts = db.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS completed
      FROM tasks WHERE club_id = ?`).get(actor.clubId) as Row;
    const memberCount = db.prepare("SELECT COUNT(*) AS n FROM members WHERE club_id = ?").get(actor.clubId) as Row;
    const unread = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE club_id = ? AND member_id = ? AND read_at IS NULL")
      .get(actor.clubId, actor.memberId) as Row;
    return {
      club: clubSummary(actor.clubId),
      counts: {
        members: int(memberCount.n),
        tasks: int(taskCounts.total),
        completedTasks: int(taskCounts.completed),
        unreadNotifications: int(unread.n),
      },
    };
  }

  /** Bounded, permission-aware search for the workspace shell. */
  function searchWorkspace(actor: Actor, rawQuery: string, limit = 6): WorkspaceSearchResult[] {
    const query = rawQuery.trim();
    if (query.length < 2) return [];
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const perKind = Math.min(Math.max(limit, 1), 10);
    const results: WorkspaceSearchResult[] = [];
    const taskRows = db.prepare(`SELECT id, title, assignee FROM tasks
      WHERE club_id = ? AND (title LIKE ? ESCAPE '\\' OR assignee LIKE ? ESCAPE '\\')
      ORDER BY created_at DESC, id LIMIT ?`).all(actor.clubId, pattern, pattern, perKind) as Row[];
    results.push(...taskRows.map((row) => ({ id: text(row.id), kind: "task" as const, label: text(row.title), detail: text(row.assignee) || "Unassigned", href: "/app/tasks" })));
    if (hasPermission(actor.role, "members:read")) {
      const memberRows = db.prepare(`SELECT id, name, email FROM members
        WHERE club_id = ? AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')
        ORDER BY joined_at DESC, id LIMIT ?`).all(actor.clubId, pattern, pattern, perKind) as Row[];
      results.push(...memberRows.map((row) => ({ id: text(row.id), kind: "member" as const, label: text(row.name), detail: text(row.email), href: `/app/members/${encodeURIComponent(text(row.id))}` })));
    }
    const eventRows = db.prepare(`SELECT id, title, venue FROM events
      WHERE club_id = ? AND (title LIKE ? ESCAPE '\\' OR venue LIKE ? ESCAPE '\\')
      ORDER BY starts_at DESC, id LIMIT ?`).all(actor.clubId, pattern, pattern, perKind) as Row[];
    results.push(...eventRows.map((row) => ({ id: text(row.id), kind: "event" as const, label: text(row.title), detail: text(row.venue), href: `/app/events/${encodeURIComponent(text(row.id))}` })));
    const announcementRows = db.prepare(`SELECT id, title FROM announcements
      WHERE club_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
      ORDER BY published_at DESC, id LIMIT ?`).all(actor.clubId, pattern, pattern, perKind) as Row[];
    results.push(...announcementRows.map((row) => ({ id: text(row.id), kind: "announcement" as const, label: text(row.title), detail: "Announcement", href: `/app/announcements/${encodeURIComponent(text(row.id))}` })));
    return results.slice(0, perKind);
  }

  /**
   * Public club overview. Member emails and finance are included only when the
   * caller holds the matching permission; the shape stays stable for the UI.
   */
  function getDashboard(actor: Actor | null = null): Dashboard {
    options.beforeRead?.(); // lapsed holds are returned before the public counters are read (audit #22)
    const clubId = actor?.clubId ?? DEFAULT_CLUB_ID;
    const timestamp = ctx.now().toISOString();
    const canSeeMembers = actor !== null && hasPermission(actor.role, "members:read");
    const canSeeFinance = actor !== null && hasPermission(actor.role, "ledger:read");
    const members = canSeeMembers ? identity.getMembers(clubId) : [];
    const club = identity.getClub(clubId);

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
    const tasks: Task[] = actor ? (db.prepare("SELECT * FROM tasks WHERE club_id = ? ORDER BY id").all(clubId) as Row[]).map((row) => ({
      id: text(row.id),
      title: text(row.title),
      assignee: text(row.assignee),
      assigneeId: row.assignee_id === null ? null : text(row.assignee_id),
      status: row.status as Task["status"],
    })) : [];
    const transactions: Transaction[] = canSeeFinance ? (
      db.prepare("SELECT * FROM transactions WHERE club_id = ? ORDER BY occurred_at DESC, id").all(clubId) as Row[]
    ).map((row) => ({
      id: text(row.id),
      description: text(row.description),
      kind: row.kind as Transaction["kind"],
      amountPaise: int(row.amount_paise),
      occurredAt: text(row.occurred_at),
    })) : [];
    const balance = canSeeFinance ? db
      .prepare(
        "SELECT COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE -amount_paise END), 0) AS balance FROM transactions WHERE club_id = ?",
      )
      .get(clubId) as Row | undefined : undefined;
    const memberCount = db.prepare("SELECT COUNT(*) AS n FROM members WHERE club_id = ?").get(clubId) as Row;
    const upcomingCount = db.prepare("SELECT COUNT(*) AS n FROM events WHERE club_id = ? AND starts_at >= ?").get(clubId, timestamp) as Row;

    return {
      club: {
        name: club ? club.name : "Sample Student Club",
        description: club ? club.description : "",
        demo: club ? club.demo : true,
      },
      metrics: {
        members: int(memberCount.n),
        activeMembers: int(
          (db.prepare(`SELECT COUNT(*) AS n FROM members WHERE club_id = ? AND left_at IS NULL AND ${MEMBERSHIP_ACTIVE_SQL}`).get(clubId, clubDate(ctx.now())) as Row).n,
        ),
        upcomingEvents: int(upcomingCount.n),
        balancePaise: canSeeFinance ? int(balance?.balance ?? 0) : 0,
      },
      members,
      events,
      announcements,
      products,
      tasks,
      transactions,
      access: { members: canSeeMembers, finance: canSeeFinance },
    };
  }

  return { getDashboard, getWorkspaceChrome, searchWorkspace };
}
