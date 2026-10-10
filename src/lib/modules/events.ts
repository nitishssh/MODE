import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Booking, EventDetails, EventReport } from "../contracts";
import { int, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { hasPermission } from "../auth/permissions";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { LedgerModule } from "./ledger";
import type { MembershipModule } from "./membership";

export const RESERVATION_HOLD_MS = 30 * 60 * 1000;

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(2000).default(""),
    startsAt: z.string().datetime({ offset: true }),
    venue: z.string().trim().min(2).max(200),
    capacity: z.number().int().min(0).max(100000),
    memberPricePaise: z.number().int().min(0),
    guestPricePaise: z.number().int().min(0),
    status: z.enum(["draft", "published", "cancelled"]).default("published"),
  })
  .strict();

export const eventUpdateSchema = eventInputSchema.partial().strict();

export const confirmBookingSchema = z
  .object({ paymentReference: z.string().trim().min(3).max(120), amountPaise: z.number().int().positive() })
  .strict();

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

function mapBooking(row: Row): Booking {
  return {
    id: text(row.id),
    eventId: text(row.event_id),
    memberId: text(row.member_id),
    pricePaise: int(row.price_paise),
    pricing: row.pricing as Booking["pricing"],
    status: row.status as Booking["status"],
    paymentId: nullableText(row.payment_id),
    ticketCode: nullableText(row.ticket_code),
    reservedUntil: text(row.reserved_until),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** Human-typable ticket code without ambiguous characters. */
function ticketCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `MODE-${code.slice(0, 4)}-${code.slice(4)}`;
}

export function createEventsModule(
  ctx: DbContext,
  identity: IdentityModule,
  membership: MembershipModule,
  ledger: LedgerModule,
) {
  const { db } = ctx;

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

  function createEvent(actor: Actor, input: z.infer<typeof eventInputSchema>): EventDetails {
    assertPermission(actor, "events:write");
    const data = eventInputSchema.parse(input);
    const id = randomUUID();
    const now = ctx.now().toISOString();
    db.prepare(
      `INSERT INTO events (id, title, starts_at, venue, capacity, registered, member_price_paise, guest_price_paise, club_id, description, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, data.title, new Date(data.startsAt).toISOString(), data.venue, data.capacity, data.memberPricePaise, data.guestPricePaise, actor.clubId, data.description, data.status, actor.memberId, now);
    identity.recordAudit(actor, "event.created", "event", id, { title: data.title });
    return requireEvent(actor.clubId, id);
  }

  function updateEvent(actor: Actor, eventId: string, input: z.infer<typeof eventUpdateSchema>): EventDetails {
    assertPermission(actor, "events:write");
    const data = eventUpdateSchema.parse(input);
    return transaction(ctx, () => {
      const current = requireEvent(actor.clubId, eventId);
      if (data.capacity !== undefined && data.capacity < current.registered) {
        throw new ValidationError(`Capacity cannot drop below the ${current.registered} seats already held.`, [{ field: "capacity", message: "Below current registrations." }]);
      }
      const next = { ...current, ...data, startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : current.startsAt };
      db.prepare(
        "UPDATE events SET title = ?, description = ?, starts_at = ?, venue = ?, capacity = ?, member_price_paise = ?, guest_price_paise = ?, status = ? WHERE id = ? AND club_id = ?",
      ).run(next.title, next.description, next.startsAt, next.venue, next.capacity, next.memberPricePaise, next.guestPricePaise, next.status, eventId, actor.clubId);
      identity.recordAudit(actor, "event.updated", "event", eventId, data);
      return requireEvent(actor.clubId, eventId);
    });
  }

  /** Release seats held by reservations whose hold has lapsed. Runs inside the caller's transaction. */
  function expireLapsedReservations(eventId: string): number {
    const now = ctx.now().toISOString();
    const lapsed = db
      .prepare("SELECT id FROM bookings WHERE event_id = ? AND status = 'reserved' AND reserved_until < ?")
      .all(eventId, now) as Row[];
    if (lapsed.length === 0) return 0;
    const mark = db.prepare("UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'reserved'");
    let released = 0;
    for (const row of lapsed) released += Number(mark.run(now, text(row.id)).changes);
    db.prepare("UPDATE events SET registered = MAX(0, registered - ?) WHERE id = ?").run(released, eventId);
    return released;
  }

  function requireBooking(clubId: string, bookingId: string): Booking {
    const row = db.prepare("SELECT * FROM bookings WHERE club_id = ? AND id = ?").get(clubId, bookingId) as Row | undefined;
    if (!row) throw new NotFoundError("Booking not found.");
    return mapBooking(row);
  }

  function priceFor(clubId: string, memberId: string, event: EventDetails): { pricePaise: number; pricing: Booking["pricing"] } {
    const status = membership.statusFor(clubId, memberId);
    return status.memberPricing
      ? { pricePaise: event.memberPricePaise, pricing: "member" }
      : { pricePaise: event.guestPricePaise, pricing: "guest" };
  }

  /**
   * Reserve one seat atomically. The conditional UPDATE plus the CHECK constraint on
   * `registered <= capacity` make overselling impossible even under concurrent requests.
   * Free seats confirm immediately; priced seats hold for RESERVATION_HOLD_MS.
   */
  function bookEvent(actor: Actor, eventId: string): Booking {
    assertPermission(actor, "bookings:create");
    return transaction(ctx, () => {
      const event = requireEvent(actor.clubId, eventId);
      if (event.status !== "published") throw new ConflictError("This event is not open for booking.", "event_not_open");
      const nowIso = ctx.now().toISOString();
      if (event.startsAt <= nowIso) throw new ConflictError("This event has already started.", "event_started");
      expireLapsedReservations(eventId);
      const existing = db
        .prepare("SELECT * FROM bookings WHERE event_id = ? AND member_id = ? AND status IN ('reserved', 'confirmed')")
        .get(eventId, actor.memberId) as Row | undefined;
      if (existing) throw new ConflictError("You already hold a booking for this event.", "duplicate_booking");

      const seat = db
        .prepare("UPDATE events SET registered = registered + 1 WHERE id = ? AND registered < capacity")
        .run(eventId);
      if (Number(seat.changes) === 0) throw new ConflictError("This event is sold out.", "sold_out");

      const { pricePaise, pricing } = priceFor(actor.clubId, actor.memberId, event);
      const id = randomUUID();
      const free = pricePaise === 0;
      db.prepare(
        `INSERT INTO bookings (id, club_id, event_id, member_id, price_paise, pricing, status, payment_id, ticket_code, reserved_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      ).run(
        id,
        actor.clubId,
        eventId,
        actor.memberId,
        pricePaise,
        pricing,
        free ? "confirmed" : "reserved",
        free ? ticketCode() : null,
        new Date(ctx.now().getTime() + RESERVATION_HOLD_MS).toISOString(),
        nowIso,
        nowIso,
      );
      identity.recordAudit(actor, free ? "booking.confirmed" : "booking.reserved", "booking", id, { eventId, pricePaise, pricing });
      return requireBooking(actor.clubId, id);
    });
  }

  /** Confirm payment for a reservation. Same reference replayed returns the same ticket. */
  function confirmBooking(actor: Actor, bookingId: string, input: z.infer<typeof confirmBookingSchema>): { booking: Booking; created: boolean } {
    assertPermission(actor, "payments:confirm");
    const data = confirmBookingSchema.parse(input);
    return transaction(ctx, () => {
      const booking = requireBooking(actor.clubId, bookingId);
      const existingPayment = membership.findPayment(actor.clubId, data.paymentReference);
      if (booking.status === "confirmed") {
        if (existingPayment && existingPayment.id === booking.paymentId) return { booking, created: false };
        throw new ConflictError("This booking is already confirmed with a different payment.", "already_confirmed");
      }
      expireLapsedReservations(booking.eventId);
      const fresh = requireBooking(actor.clubId, bookingId);
      if (fresh.status !== "reserved") throw new ConflictError(`This reservation is ${fresh.status}; book again to get a new seat.`, "reservation_not_active");
      if (data.amountPaise !== fresh.pricePaise) {
        throw new ValidationError(`This ticket costs ${fresh.pricePaise} paise.`, [{ field: "amountPaise", message: `Expected ${fresh.pricePaise}.` }]);
      }
      const { payment, created } = membership.recordPayment({
        clubId: actor.clubId,
        memberId: fresh.memberId,
        purpose: "ticket",
        targetId: fresh.id,
        reference: data.paymentReference,
        amountPaise: fresh.pricePaise,
        recordedBy: actor.memberId,
      });
      if (!created && payment.targetId !== fresh.id) {
        throw new ConflictError("This payment reference belongs to a different booking.", "payment_reference_reused");
      }
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE bookings SET status = 'confirmed', payment_id = ?, ticket_code = ?, updated_at = ? WHERE id = ?").run(payment.id, ticketCode(), nowIso, fresh.id);
      const event = requireEvent(actor.clubId, fresh.eventId);
      if (!ledger.hasEntryFor({ type: "payment", id: payment.id })) {
        ledger.postEntry({
          clubId: actor.clubId,
          kind: "income",
          category: "ticket",
          amountPaise: payment.amountPaise,
          description: `Ticket · ${event.title}`,
          source: { type: "payment", id: payment.id },
          eventId: event.id,
          memberId: fresh.memberId,
        });
      }
      identity.recordAudit(actor, "booking.confirmed", "booking", fresh.id, { paymentId: payment.id });
      return { booking: requireBooking(actor.clubId, fresh.id), created: true };
    });
  }

  /** Owner or organizer cancels; the seat is released and the ticket stops working. */
  function cancelBooking(actor: Actor, bookingId: string): Booking {
    return transaction(ctx, () => {
      const booking = requireBooking(actor.clubId, bookingId);
      if (booking.memberId !== actor.memberId && !hasPermission(actor.role, "events:write")) throw new ForbiddenError();
      if (booking.status === "cancelled") return booking;
      if (booking.status === "expired") throw new ConflictError("This reservation already expired.", "reservation_not_active");
      if (db.prepare("SELECT 1 FROM check_ins WHERE booking_id = ?").get(bookingId)) {
        throw new ConflictError("This ticket has already been used at the entrance.", "already_checked_in");
      }
      const nowIso = ctx.now().toISOString();
      db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?").run(nowIso, bookingId);
      db.prepare("UPDATE events SET registered = MAX(0, registered - 1) WHERE id = ?").run(booking.eventId);
      identity.recordAudit(actor, "booking.cancelled", "booking", bookingId, { previousStatus: booking.status, paid: booking.paymentId !== null });
      return requireBooking(actor.clubId, bookingId);
    });
  }

  function myBookings(actor: Actor): Booking[] {
    return (db.prepare("SELECT * FROM bookings WHERE club_id = ? AND member_id = ? ORDER BY created_at DESC").all(actor.clubId, actor.memberId) as Row[]).map(mapBooking);
  }

  /** Entrance scan. Invalid, cancelled, unpaid and repeated codes are rejected with distinct reasons. */
  function checkIn(actor: Actor, code: string) {
    assertPermission(actor, "tickets:check_in");
    const normalized = code.trim().toUpperCase();
    return transaction(ctx, () => {
      const row = db.prepare("SELECT * FROM bookings WHERE club_id = ? AND ticket_code = ?").get(actor.clubId, normalized) as Row | undefined;
      if (!row) throw new NotFoundError("Unknown ticket code.");
      const booking = mapBooking(row);
      if (booking.status !== "confirmed") throw new ConflictError(`This ticket is ${booking.status}.`, "ticket_not_valid");
      const previous = db.prepare("SELECT checked_in_at FROM check_ins WHERE booking_id = ?").get(booking.id) as Row | undefined;
      if (previous) {
        throw new ConflictError(`Already checked in at ${text(previous.checked_in_at)}.`, "already_checked_in");
      }
      const checkedInAt = ctx.now().toISOString();
      db.prepare("INSERT INTO check_ins VALUES (?, ?, ?, ?)").run(booking.id, booking.eventId, actor.memberId, checkedInAt);
      const member = identity.requireMember(actor.clubId, booking.memberId);
      identity.recordAudit(actor, "ticket.checked_in", "booking", booking.id);
      return { booking, attendee: { id: member.id, name: member.name }, checkedInAt };
    });
  }

  function eventReport(actor: Actor, eventId: string): EventReport {
    assertPermission(actor, "events:report");
    return transaction(ctx, () => {
      expireLapsedReservations(eventId);
      const event = requireEvent(actor.clubId, eventId);
      const counts = db
        .prepare("SELECT status, COUNT(*) AS n FROM bookings WHERE event_id = ? GROUP BY status")
        .all(eventId) as Row[];
      const byStatus = { reserved: 0, confirmed: 0, cancelled: 0, expired: 0 };
      for (const row of counts) byStatus[text(row.status) as keyof typeof byStatus] = int(row.n);
      const checkedIn = int((db.prepare("SELECT COUNT(*) AS n FROM check_ins WHERE event_id = ?").get(eventId) as Row).n);
      const income = db
        .prepare("SELECT COALESCE(SUM(amount_paise), 0) AS total FROM transactions WHERE event_id = ? AND kind = 'income'")
        .get(eventId) as Row;
      const attendees = (
        db
          .prepare(
            `SELECT m.id, m.name, b.pricing, b.status, c.checked_in_at
             FROM bookings b JOIN members m ON m.id = b.member_id LEFT JOIN check_ins c ON c.booking_id = b.id
             WHERE b.event_id = ? AND b.status = 'confirmed' ORDER BY m.name COLLATE NOCASE`,
          )
          .all(eventId) as Row[]
      ).map((row) => ({ memberId: text(row.id), name: text(row.name), pricing: row.pricing as Booking["pricing"], checkedInAt: nullableText(row.checked_in_at) }));
      return {
        event,
        bookings: byStatus,
        checkedIn,
        incomePaise: int(income.total),
        attendees,
      };
    });
  }

  return {
    listEvents,
    requireEvent,
    createEvent,
    updateEvent,
    bookEvent,
    confirmBooking,
    cancelBooking,
    myBookings,
    requireBooking,
    checkIn,
    eventReport,
    priceFor,
  };
}

export type EventsModule = ReturnType<typeof createEventsModule>;
