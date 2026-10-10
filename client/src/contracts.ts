/** Generated from src/lib/contracts.ts by scripts/sync-contracts.ts. */
export type Role = "member" | "volunteer" | "organizer" | "treasurer" | "admin";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  clubId: string;
  permissions: string[];
}

export interface AuthResponse {
  user: SessionUser;
  expiresAt: string;
  token: string;
}

export interface MemberPass {
  qrToken: string;
  shortCode: string;
  membership: "active" | "expired" | "none";
  expiresOn: string | null;
}

export interface Event {
  id: string;
  title: string;
  startsAt: string;
  venue: string;
  capacity: number;
  registered: number;
  memberPricePaise: number;
  guestPricePaise: number;
}

export type EventStatus = "draft" | "published" | "cancelled";

export interface EventDetails extends Event {
  description: string;
  status: EventStatus;
  /** Seats not held or sold: capacity minus registered. */
  available: number;
}

export type TicketStatus = "pending_payment" | "paid" | "cancelled" | "expired";

export interface Ticket {
  id: string;
  eventId: string;
  memberId: string | null;
  guestName: string | null;
  /** Masked unless the viewer is an officer. */
  guestEmail: string | null;
  holderName: string;
  pricing: "member" | "guest";
  pricePaise: number;
  status: TicketStatus;
  holdExpiresAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  confirmedBy: string | null;
  /** 10-character Crockford code typed at the door. */
  shortCode: string;
  /** Only returned to the holder (member booking response, own list, /t/{token}). */
  qrToken?: string;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScanOutcome = "admitted" | "already_checked_in" | "payment_pending" | "not_valid" | "member_no_ticket" | "no_ticket_membership_expired";

export interface ScanResult {
  outcome: ScanOutcome;
  message: string;
  admitted: boolean;
  attendee?: { name: string; membership: "active" | "expired" | "none" | "guest" };
  ticketId?: string;
  checkedInAt?: string | null;
}

export interface PublicTicket {
  id: string;
  event: { id: string; title: string; startsAt: string; venue: string };
  holderName: string;
  status: TicketStatus;
  pricePaise: number;
  shortCode: string;
  holdExpiresAt: string | null;
  checkedInAt: string | null;
}
