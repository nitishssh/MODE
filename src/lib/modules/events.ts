import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasPermission } from "../auth/permissions";
import { allocateUniqueTokens, normalizeShortCode } from "../auth/tokens";
import type { EventDetails, EventReport, PublicTicket, ScanOutcome, ScanResult, Ticket } from "../contracts";
import { SQLITE_CONSTRAINT_UNIQUE, clubDate, int, isConstraintError, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import { SOURCE_RESOLVERS, postLedgerEntry } from "./ledger";
import { membershipState } from "./membership-state";

/** A pending booking holds its seat for this long; then releaseExpiredHolds() returns it. */
export const HOLD_MINUTES = 30;
export const HOLD_MS = HOLD_MINUTES * 60_000;
/** Anonymous guests may hold at most this many unpaid seats per event at once (audit #11). */
export function maxPendingGuestHolds(capacity: number): number {
  return Math.max(3, Math.ceil(capacity / 10));
}

/** The fixed door contract (#5). Volunteers read `message` aloud; clients may key on `outcome`. */
export const DOOR_MESSAGES: Record<ScanOutcome, string> = {
  admitted: "Admitted",
  already_checked_in: "Already checked in",
  payment_pending: "Payment pending",
  not_valid: "Not valid for this event",
  member_no_ticket: "Member, no ticket",
  no_ticket_membership_expired: "No ticket · membership expired",
};

const eventFields = {
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000),
  startsAt: z.iso.datetime({ offset: true }),
  venue: z.string().trim().min(2).max(200),
  capacity: z.number().int().min(0).max(100_000),
  memberPricePaise: z.number().int().min(0),
  guestPricePaise: z.number().int().min(0),
  status: z.enum(["draft", "published", "cancelled"]),
};
export const createEventSchema = z
  .object({ ...eventFields, description: eventFields.description.default(""), status: eventFields.status.default("published") })
  .strict();
/** PATCH is built from the default-free fields: Zod 4 keeps `.default()` through `.partial()`. */
export const updateEventSchema = z.object(eventFields).partial().strict();
export const guestBookingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().max(254).email("Enter a valid email address.").toLowerCase(),
  })
  .strict();
export const confirmTicketSchema = z.object({ reference: z.string().trim().min(3).max(120) }).strict();
export const scanSchema = z.object({ credential: z.string().trim().min(1).max(200) }).strict();

SOURCE_RESOLVERS.ticket = (db, sourceId) => db.prepare("SELECT 1 FROM tickets WHERE id = ? AND status = 'paid'").get(sourceId) !== undefined;

function mapEvent(row: Row): EventDetails {
  const capacity = int(row.capacity);
  const registered = int(row.registered);
  return {
    id: text(row.id),
    title: text(row.title),
    startsAt: text(row.starts_at),
    venue: text(row.venue),
    capacity,
    registered,
    memberPricePaise: int(row.member_price_paise),
    guestPricePaise: int(row.guest_price_paise),
    description: text(row.description),
    status: row.status as EventDetails["status"],
    available: Math.max(0, capacity - registered),
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain ?? ""}`;
}

/** Ticket rows are always read joined to the holder's member name (NULL for guests). */
const TICKET_SELECT = "SELECT t.*, m.name AS member_name FROM tickets t LEFT JOIN members m ON m.id = t.member_id";

function mapTicket(row: Row, view: { token?: boolean; officer?: boolean } = {}): Ticket {
  const guestEmail = nullableText(row.guest_email);
  const ticket: Ticket = {
    id: text(row.id),
    eventId: text(row.event_id),
    memberId: nullableText(row.member_id),
    guestName: nullableText(row.guest_name),
    guestEmail: guestEmail === null ? null : view.officer ? guestEmail : maskEmail(guestEmail),
    holderName: nullableText(row.member_name) ?? text(row.guest_name),
    pricing: row.pricing as Ticket["pricing"],
    pricePaise: int(row.price_paise),
    status: row.status as Ticket["status"],
    holdExpiresAt: nullableText(row.hold_expires_at),
    paidAt: nullableText(row.paid_at),
    paymentReference: nullableText(row.payment_reference),
    confirmedBy: nullableText(row.confirmed_by),
    shortCode: text(row.short_code),
    checkedInAt: nullableText(row.checked_in_at),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
  if (view.token) ticket.qrToken = text(row.qr_token);
  return ticket;
}

interface Holder {
  memberId: string | null;
  guestName: string | null;
  guestEmail: string | null;
}

/** Event tickets (P2, #5): atomic seats, 30-minute holds, officer confirmation, the door contract. */
export function createEventsModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;
  const tokenTaken = db.prepare(
    "SELECT 1 FROM tickets WHERE qr_token = ? OR short_code = ? UNION ALL SELECT 1 FROM members WHERE qr_token = ? OR short_code = ?",
  );

  // ----- events -------------------------------------------------------------

  function listEvents(clubId: string, options: { includeUnpublished?: boolean } = {}): EventDetails[] {
    const sql = options.includeUnpublished
      ? "SELECT * FROM events WHERE club_id = ? ORDER BY starts_at, id"
      : "SELECT * FROM events WHERE club_id = ? AND status = 'published' ORDER BY starts_at, id";
    return (db.prepare(sql).all(clubId) as Row[]).map(mapEvent);
  }

  function requireEvent(clubId: string, eventId: string): EventDetails {
    const row = db.prepare("SELECT * FROM events WHERE club_id = ? AND id = ?").get(clubId, eventId) as Row | undefined;
    if (!row) throw new NotFoundError("Event not found.");
    return mapEvent(row);
  }

  /** Public read: drafts are visible only to organizers. */
  function getEvent(actor: Actor | null, clubId: string, eventId: string): EventDetails {
    const event = requireEvent(clubId, eventId);
    if (event.status === "draft" && !(actor && hasPermission(actor.role, "events:write"))) throw new NotFoundError("Event not found.");
    return event;
  }

  function createEvent(actor: Actor, input: z.input<typeof createEventSchema>): EventDetails {
    assertPermission(actor, "events:write");
    const data = parseInput(createEventSchema, input);
    const id = randomUUID();
    return transaction(ctx, () => {
      db.prepare(
        `INSERT INTO events (id, title, starts_at, venue, capacity, registered, member_price_paise, guest_price_paise, club_id, status, description)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      ).run(id, data.title, new Date(data.startsAt).toISOString(), data.venue, data.capacity, data.memberPricePaise, data.guestPricePaise, actor.clubId, data.status, data.description);
      identity.recordAudit(actor, "event.created", "event", id, { title: data.title, status: data.status });
      return requireEvent(actor.clubId, id);
    });
  }

  function updateEvent(actor: Actor, eventId: string, input: z.input<typeof updateEventSchema>): EventDetails {
    assertPermission(actor, "events:write");
    const data = parseInput(updateEventSchema, input);
    return transaction(ctx, () => {
      releaseExpiredHolds(eventId);
      const current = requireEvent(actor.clubId, eventId);
      if (data.capacity !== undefined && data.capacity < current.registered) {
        throw new ValidationError(`Capacity cannot drop below the ${current.registered} seats already held or sold.`, [{ field: "capacity", message: "Below current registrations." }]);
      }
      const next = { ...current, ...data, startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : current.startsAt };
      db.prepare(
        "UPDATE events SET title = ?, description = ?, starts_at = ?, venue = ?, capacity = ?, member_price_paise = ?, guest_price_paise = ?, status = ? WHERE id = ? AND club_id = ?",
      ).run(next.title, next.description, next.startsAt, next.venue, next.capacity, next.memberPricePaise, next.guestPricePaise, next.status, eventId, actor.clubId);
      let releasedHolds = 0;
      if (next.status === "cancelled" && current.status !== "cancelled") {
        // Cancelling an event ends its unpaid holds; paid tickets keep their record (refunds are outside this MVP) but the door refuses them (audit #1).
        const nowIso = ctx.now().toISOString();
        releasedHolds = Number(db.prepare("UPDATE tickets SET status = 'cancelled', updated_at = ? WHERE event_id = ? AND status = 'pending_payment'").run(nowIso, eventId).changes);
        if (releasedHolds) db.prepare("UPDATE events SET registered = MAX(0, registered - ?) WHERE id = ?").run(releasedHolds, eventId);
      }
      identity.recordAudit(actor, "event.updated", "event", eventId, { ...data, ...(releasedHolds ? { releasedHolds } : {}) });
      return requireEvent(actor.clubId, eventId);
    });
  }

  // ----- holds --------------------------------------------------------------

  /**
   * Expire lapsed pending holds and return their seats, exactly once. Must run inside the
   * caller's transaction (booking, confirmation, scan, list reads) so no writer interleaves.
   */
  function releaseExpiredHolds(eventId?: string): number {
    if (ctx.depth === 0) throw new Error("releaseExpiredHolds must run inside a transaction.");
    const nowIso = ctx.now().toISOString();
    const lapsed = (
      eventId
        ? db.prepare("SELECT event_id FROM tickets WHERE event_id = ? AND status = 'pending_payment' AND hold_expires_at <= ? GROUP BY event_id").all(eventId, nowIso)
        : db.prepare("SELECT event_id FROM tickets WHERE status = 'pending_payment' AND hold_expires_at <= ? GROUP BY event_id").all(nowIso)
    ) as Row[];
    let released = 0;
    for (const row of lapsed) {
      const id = text(row.event_id);
      const changes = Number(
        db.prepare("UPDATE tickets SET status = 'expired', updated_at = ? WHERE event_id = ? AND status = 'pending_payment' AND hold_expires_at <= ?").run(nowIso, id, nowIso).changes,
      );
      db.prepare("UPDATE events SET registered = MAX(0, registered - ?) WHERE id = ?").run(changes, id);
      released += changes;
    }
    return released;
  }

  /** Reads call this instead of opening a write transaction: the write lock is taken only when a hold has actually lapsed (audit #13). */
  function releaseIfLapsed(eventId?: string): number {
    const nowIso = ctx.now().toISOString();
    const lapsed = eventId
      ? db.prepare("SELECT 1 FROM tickets WHERE event_id = ? AND status = 'pending_payment' AND hold_expires_at <= ? LIMIT 1").get(eventId, nowIso)
      : db.prepare("SELECT 1 FROM tickets WHERE status = 'pending_payment' AND hold_expires_at <= ? LIMIT 1").get(nowIso);
    if (!lapsed) return 0;
    return transaction(ctx, () => releaseExpiredHolds(eventId));
  }

  // ----- booking ------------------------------------------------------------

  function requireTicketRow(clubId: string, ticketId: string): Row {
    const row = db.prepare(`${TICKET_SELECT} WHERE t.club_id = ? AND t.id = ?`).get(clubId, ticketId) as Row | undefined;
    if (!row) throw new NotFoundError("Ticket not found.");
    return row;
  }

  /** Reserve one seat: conditional capacity UPDATE inside BEGIN IMMEDIATE, no awaits, then the ticket row. */
  function issueTicket(clubId: string, event: EventDetails, holder: Holder, pricing: Ticket["pricing"], pricePaise: number): string {
    if (event.status !== "published") throw new ConflictError("This event is not open for booking.", "event_not_open");
    const now = ctx.now();
    const nowIso = now.toISOString();
    if (event.startsAt <= nowIso) throw new ConflictError("This event has already started.", "event_started");
    const existing = db
      .prepare("SELECT 1 FROM tickets WHERE event_id = ? AND status IN ('pending_payment', 'paid') AND (member_id = ? OR guest_email = ?)")
      .get(event.id, holder.memberId, holder.guestEmail);
    if (existing) throw new ConflictError("There is already a ticket for this event under this name.", "duplicate_ticket");

    const seat = db.prepare("UPDATE events SET registered = registered + 1 WHERE id = ? AND registered < capacity").run(event.id);
    if (Number(seat.changes) === 0) throw new ConflictError("This event is sold out.", "sold_out");

    const tokens = allocateUniqueTokens((c) => tokenTaken.get(c.qrToken, c.shortCode, c.qrToken, c.shortCode) !== undefined);
    const id = randomUUID();
    const free = pricePaise === 0;
    try {
      db.prepare(
        `INSERT INTO tickets (id, club_id, event_id, member_id, guest_name, guest_email, pricing, price_paise, status, hold_expires_at, paid_at, payment_reference, confirmed_by, qr_token, short_code, checked_in_at, checked_in_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, ?)`,
      ).run(
        id,
        clubId,
        event.id,
        holder.memberId,
        holder.guestName,
        holder.guestEmail,
        pricing,
        pricePaise,
        free ? "paid" : "pending_payment",
        free ? null : new Date(now.getTime() + HOLD_MS).toISOString(),
        free ? nowIso : null,
        tokens.qrToken,
        tokens.shortCode,
        nowIso,
        nowIso,
      );
    } catch (error) {
      // The partial UNIQUE indexes are the concurrency guarantee for "one live ticket per holder per event".
      if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new ConflictError("There is already a ticket for this event under this name.", "duplicate_ticket");
      throw error;
    }
    return id;
  }

  /** Member booking. Price is fixed from membershipState at booking time. */
  function bookTicket(actor: Actor, eventId: string): Ticket {
    assertPermission(actor, "bookings:create");
    return transaction(ctx, () => {
      releaseExpiredHolds(eventId);
      const event = requireEvent(actor.clubId, eventId);
      const member = identity.requireMember(actor.clubId, actor.memberId);
      const active = membershipState(member, clubDate(ctx.now())) === "active";
      const pricing: Ticket["pricing"] = active ? "member" : "guest";
      const id = issueTicket(actor.clubId, event, { memberId: member.id, guestName: null, guestEmail: null }, pricing, active ? event.memberPricePaise : event.guestPricePaise);
      identity.recordAudit(actor, "ticket.booked", "ticket", id, { eventId, pricing });
      return mapTicket(requireTicketRow(actor.clubId, id), { token: true });
    });
  }

  /** Guest booking by name and email; no account. The response carries the /t/{qrToken} link. */
  function bookGuestTicket(clubId: string, eventId: string, input: z.input<typeof guestBookingSchema>): Ticket {
    const data = parseInput(guestBookingSchema, input);
    return transaction(ctx, () => {
      releaseExpiredHolds(eventId);
      const event = requireEvent(clubId, eventId);
      if (db.prepare("SELECT 1 FROM members WHERE club_id = ? AND email = ? AND left_at IS NULL").get(clubId, data.email)) {
        throw new ConflictError("This email belongs to a club member. Sign in to book at the member price.", "member_email");
      }
      const pendingGuests = int((db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND guest_email IS NOT NULL AND status = 'pending_payment'").get(event.id) as Row).n);
      if (pendingGuests >= maxPendingGuestHolds(event.capacity)) {
        throw new ConflictError("Guest holds for this event are full right now; try again in a few minutes.", "guest_holds_full");
      }
      const id = issueTicket(clubId, event, { memberId: null, guestName: data.name, guestEmail: data.email }, "guest", event.guestPricePaise);
      identity.recordAudit(null, "ticket.booked", "ticket", id, { eventId, pricing: "guest", guest: true }, clubId);
      return mapTicket(requireTicketRow(clubId, id), { token: true });
    });
  }

  // ----- payment and cancellation ------------------------------------------

  /**
   * Officer confirms payment: expired holds are released first, then one conditional UPDATE
   * moves pending_payment -> paid and exactly one `ticket` income row is posted.
   */
  function confirmTicket(actor: Actor, ticketId: string, input: z.input<typeof confirmTicketSchema>): { ticket: Ticket; created: boolean } {
    assertPermission(actor, "payments:confirm");
    const data = parseInput(confirmTicketSchema, input);
    const before = mapTicket(requireTicketRow(actor.clubId, ticketId), { officer: true });
    releaseIfLapsed(before.eventId); // its own transaction, so a conflict below cannot roll the release back (audit #24)
    return transaction(ctx, () => {
      const nowIso = ctx.now().toISOString();
      // One external payment pays for one ticket (audit #3); the UNIQUE index is the backstop.
      if (db.prepare("SELECT 1 FROM tickets WHERE club_id = ? AND payment_reference = ? AND id <> ?").get(actor.clubId, data.reference, ticketId)) {
        throw new ConflictError("This payment reference is already recorded against another ticket.", "payment_reference_reused");
      }
      const moved = db
        .prepare("UPDATE tickets SET status = 'paid', paid_at = ?, payment_reference = ?, confirmed_by = ?, hold_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'pending_payment'")
        .run(nowIso, data.reference, actor.memberId, nowIso, ticketId);
      if (Number(moved.changes) === 0) {
        const fresh = mapTicket(requireTicketRow(actor.clubId, ticketId), { officer: true });
        if (fresh.status === "paid") {
          // Duplicate confirmation: same answer, no second income; a different reference is a real disagreement (audit #4).
          if (fresh.paymentReference !== data.reference) throw new ConflictError("This ticket was already confirmed with a different payment reference.", "payment_reference_mismatch");
          return { ticket: fresh, created: false };
        }
        throw new ConflictError("Hold expired, rebook", "hold_expired");
      }
      const event = requireEvent(actor.clubId, before.eventId);
      postLedgerEntry(ctx, {
        kind: "income",
        amountPaise: before.pricePaise,
        description: `Ticket · ${event.title} · ${before.holderName}`,
        source: { type: "ticket", id: ticketId },
        recordedBy: actor.memberId,
        clubId: actor.clubId,
        eventId: before.eventId,
      });
      identity.recordAudit(actor, "ticket.paid", "ticket", ticketId, { reference: data.reference, amountPaise: before.pricePaise });
      return { ticket: mapTicket(requireTicketRow(actor.clubId, ticketId), { officer: true }), created: true };
    });
  }

  /** Owners cancel their own pending booking; officers with payments:confirm cancel any pending hold. */
  function cancelTicket(actor: Actor, ticketId: string): Ticket {
    return transaction(ctx, () => {
      const ticket = mapTicket(requireTicketRow(actor.clubId, ticketId));
      const officer = hasPermission(actor.role, "payments:confirm");
      if (ticket.memberId !== actor.memberId && !officer) throw new ForbiddenError();
      releaseExpiredHolds(ticket.eventId);
      const fresh = mapTicket(requireTicketRow(actor.clubId, ticketId), { officer });
      if (fresh.status === "cancelled") return fresh; // repeat cancellation is a no-op
      if (fresh.status === "paid") throw new ConflictError("Paid tickets cannot be cancelled here; refunds are outside this MVP.", "refunds_out_of_scope");
      if (fresh.status === "expired") throw new ConflictError("Hold expired, rebook", "hold_expired");
      const nowIso = ctx.now().toISOString();
      const changes = Number(db.prepare("UPDATE tickets SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending_payment'").run(nowIso, ticketId).changes);
      if (changes === 1) db.prepare("UPDATE events SET registered = MAX(0, registered - 1) WHERE id = ?").run(fresh.eventId);
      identity.recordAudit(actor, "ticket.cancelled", "ticket", ticketId, { byOwner: ticket.memberId === actor.memberId });
      return mapTicket(requireTicketRow(actor.clubId, ticketId), { officer });
    });
  }

  // ----- reads --------------------------------------------------------------

  function pendingHolds(actor: Actor, eventId: string): Ticket[] {
    assertPermission(actor, "payments:confirm");
    requireEvent(actor.clubId, eventId);
    releaseIfLapsed(eventId);
    return (db.prepare(`${TICKET_SELECT} WHERE t.event_id = ? AND t.status = 'pending_payment' ORDER BY t.hold_expires_at, t.id`).all(eventId) as Row[]).map((row) => mapTicket(row, { officer: true }));
  }

  function eventTickets(actor: Actor, eventId: string): Ticket[] {
    assertPermission(actor, "payments:confirm");
    requireEvent(actor.clubId, eventId);
    releaseIfLapsed(eventId);
    return (db.prepare(`${TICKET_SELECT} WHERE t.event_id = ? ORDER BY t.created_at DESC, t.id`).all(eventId) as Row[]).map((row) => mapTicket(row, { officer: true }));
  }

  function myTickets(actor: Actor): Ticket[] {
    releaseIfLapsed();
    return (db.prepare(`${TICKET_SELECT} WHERE t.club_id = ? AND t.member_id = ? ORDER BY t.created_at DESC, t.id`).all(actor.clubId, actor.memberId) as Row[]).map((row) => mapTicket(row, { token: true }));
  }

  /** /t/{qr_token}: the holder's view, resolved by the random token only. Anonymous reads never take the write lock. */
  function publicTicket(qrToken: string): PublicTicket {
    releaseIfLapsed();
    {
      const row = db
        .prepare(
          `SELECT t.*, m.name AS member_name, e.title AS event_title, e.starts_at AS event_starts_at, e.venue AS event_venue
           FROM tickets t LEFT JOIN members m ON m.id = t.member_id JOIN events e ON e.id = t.event_id WHERE t.qr_token = ?`,
        )
        .get(qrToken.trim()) as Row | undefined;
      if (!row) throw new NotFoundError("Ticket not found.");
      const ticket = mapTicket(row);
      return {
        id: ticket.id,
        event: { id: ticket.eventId, title: text(row.event_title), startsAt: text(row.event_starts_at), venue: text(row.event_venue) },
        holderName: ticket.holderName,
        status: ticket.status,
        pricePaise: ticket.pricePaise,
        shortCode: ticket.shortCode,
        holdExpiresAt: ticket.holdExpiresAt,
        checkedInAt: ticket.checkedInAt,
      };
    }
  }

  // ----- the door -----------------------------------------------------------

  function result(outcome: ScanOutcome, extra: Omit<ScanResult, "outcome" | "message" | "admitted"> = {}): ScanResult {
    return { outcome, message: DOOR_MESSAGES[outcome], admitted: outcome === "admitted", ...extra };
  }

  function attendeeFor(ticket: Ticket, today: string): ScanResult["attendee"] {
    if (ticket.memberId === null) return { name: ticket.holderName, membership: "guest" };
    const member = db.prepare("SELECT expires_on FROM members WHERE id = ?").get(ticket.memberId) as Row | undefined;
    return { name: ticket.holderName, membership: membershipState({ expiresOn: nullableText(member?.expires_on ?? null) }, today) };
  }

  /** Admission depends on the paid ticket only. One conditional UPDATE means a repeat scan can never admit twice. */
  function admit(actor: Actor, ticket: Ticket, event: EventDetails): ScanResult {
    if (ticket.eventId !== event.id) return result("not_valid");
    const today = clubDate(ctx.now());
    switch (ticket.status) {
      case "pending_payment":
        return result("payment_pending", { ticketId: ticket.id, attendee: attendeeFor(ticket, today) });
      case "cancelled":
      case "expired":
        return result("not_valid", { ticketId: ticket.id });
      case "paid": {
        const nowIso = ctx.now().toISOString();
        const changes = Number(
          db.prepare("UPDATE tickets SET checked_in_at = ?, checked_in_by = ?, updated_at = ? WHERE id = ? AND status = 'paid' AND checked_in_at IS NULL").run(nowIso, actor.memberId, nowIso, ticket.id).changes,
        );
        if (changes === 1) {
          identity.recordAudit(actor, "ticket.checked_in", "ticket", ticket.id, { eventId: event.id });
          return result("admitted", { ticketId: ticket.id, attendee: attendeeFor(ticket, today), checkedInAt: nowIso });
        }
        const original = nullableText((db.prepare("SELECT checked_in_at FROM tickets WHERE id = ?").get(ticket.id) as Row).checked_in_at);
        return result("already_checked_in", { ticketId: ticket.id, attendee: attendeeFor(ticket, today), checkedInAt: original });
      }
    }
  }

  /**
   * Scanner: the event is selected first; the credential is a ticket token/code or a member
   * token/code, never a sequential id. A member resolves to their single live ticket for the event.
   */
  function scan(actor: Actor, eventId: string, input: z.input<typeof scanSchema>): ScanResult {
    assertPermission(actor, "tickets:check_in");
    const { credential } = parseInput(scanSchema, input);
    return transaction(ctx, () => {
      const event = requireEvent(actor.clubId, eventId);
      // A cancelled or draft event admits nobody, whatever the ticket says (audit #1).
      if (event.status !== "published") return result("not_valid");
      releaseExpiredHolds(eventId);
      const ticketRow = db
        .prepare(`${TICKET_SELECT} WHERE t.club_id = ? AND (t.qr_token = ? OR t.short_code = ?)`)
        .get(actor.clubId, credential, normalizeShortCode(credential)) as Row | undefined;
      if (ticketRow) return admit(actor, mapTicket(ticketRow), event);

      const member = identity.findMemberByPass(actor.clubId, credential);
      if (!member) return result("not_valid");
      const memberTicket = db
        .prepare(`${TICKET_SELECT} WHERE t.event_id = ? AND t.member_id = ? AND t.status IN ('pending_payment', 'paid')`)
        .get(eventId, member.id) as Row | undefined;
      if (memberTicket) return admit(actor, mapTicket(memberTicket), event);
      const membership = membershipState(member, clubDate(ctx.now()));
      return result(membership === "active" ? "member_no_ticket" : "no_ticket_membership_expired", { attendee: { name: member.name, membership } });
    });
  }

  // ----- report -------------------------------------------------------------

  function eventReport(actor: Actor, eventId: string): EventReport {
    assertPermission(actor, "events:report");
    return transaction(ctx, () => {
      releaseExpiredHolds(eventId);
      const event = requireEvent(actor.clubId, eventId);
      const tickets = { pendingPayment: 0, paid: 0, cancelled: 0, expired: 0 };
      const keys = { pending_payment: "pendingPayment", paid: "paid", cancelled: "cancelled", expired: "expired" } as const;
      for (const row of db.prepare("SELECT status, COUNT(*) AS n FROM tickets WHERE event_id = ? GROUP BY status").all(eventId) as Row[]) {
        tickets[keys[text(row.status) as Ticket["status"]]] = int(row.n);
      }
      const attendance = int((db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND checked_in_at IS NOT NULL").get(eventId) as Row).n);
      const revenue = db
        .prepare("SELECT COALESCE(SUM(tr.amount_paise), 0) AS total FROM transactions tr JOIN tickets t ON t.id = tr.source_id WHERE tr.source_type = 'ticket' AND tr.kind = 'income' AND t.event_id = ?")
        .get(eventId) as Row;
      return { event, tickets, ticketsSold: tickets.paid, attendance, realizedRevenuePaise: int(revenue.total) };
    });
  }

  return {
    listEvents,
    getEvent,
    requireEvent,
    createEvent,
    updateEvent,
    releaseExpiredHolds,
    releaseIfLapsed,
    bookTicket,
    bookGuestTicket,
    confirmTicket,
    cancelTicket,
    pendingHolds,
    eventTickets,
    myTickets,
    publicTicket,
    scan,
    eventReport,
  };
}

export type EventsModule = ReturnType<typeof createEventsModule>;
