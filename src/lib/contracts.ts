/** Public API shapes. Money is stored and returned as integer paise. */
export type Role = "member" | "volunteer" | "organizer" | "treasurer" | "admin";

export interface Member {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  expiresOn: string | null;
  duesStatus: "paid" | "unpaid";
  role: Role;
  /** Derived from `expiresOn` against the club calendar day; see membershipState(). */
  membership: "active" | "expired" | "none";
  /** 10-character Crockford base32 door code; the QR token is only returned to the member themselves. */
  shortCode: string;
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

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export interface Product {
  id: string;
  name: string;
  pricePaise: number;
  stock: number;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: "todo" | "in_progress" | "done";
}

export interface Transaction {
  id: string;
  description: string;
  kind: "income" | "expense";
  amountPaise: number;
  occurredAt: string;
}

/** Ledger row with its source identity (P0). Each (sourceType, sourceId) posts exactly once. */
export interface LedgerEntry extends Transaction {
  sourceType: string | null;
  sourceId: string | null;
  recordedBy: string | null;
}

/** Membership dues (P1, #4) */
export interface DuesPayment {
  id: string;
  memberId: string;
  reference: string;
  amountPaise: number;
  previousExpiresOn: string | null;
  newExpiresOn: string;
  recordedBy: string;
  recordedAt: string;
}

export interface ExpiringMember {
  id: string;
  name: string;
  email: string;
  expiresOn: string;
  daysLeft: number;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

/** Event tickets (P2, #5) */
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

/** What a guest sees at /t/{qr_token}. */
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

export type ScanOutcome = "admitted" | "already_checked_in" | "payment_pending" | "not_valid" | "member_no_ticket" | "no_ticket_membership_expired";

/** Fixed door contract (#5). `message` is what the volunteer reads out. */
export interface ScanResult {
  outcome: ScanOutcome;
  message: string;
  admitted: boolean;
  attendee?: { name: string; membership: "active" | "expired" | "none" | "guest" };
  ticketId?: string;
  checkedInAt?: string | null;
}

export interface EventReport {
  event: EventDetails;
  tickets: { pendingPayment: number; paid: number; cancelled: number; expired: number };
  ticketsSold: number;
  attendance: number;
  /** Sum of `ticket` income rows in the ledger for this event. */
  realizedRevenuePaise: number;
}

/** Merchandise (P3, #6) */
export interface ProductVariant {
  id: string;
  size: string;
  /** Units available to order right now (holds already subtracted). */
  stock: number;
}

export interface ProductDetails extends Product {
  description: string;
  /** Price for active members; null means no member discount. */
  memberPricePaise: number | null;
  active: boolean;
  variants: ProductVariant[];
}

export type MerchOrderStatus = "pending_payment" | "paid" | "fulfilled" | "cancelled" | "expired";

export interface MerchOrder {
  id: string;
  memberId: string;
  memberName: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  pricing: "member" | "standard";
  status: MerchOrderStatus;
  holdExpiresAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  confirmedBy: string | null;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a member shows at the door: QR payload and typed fallback. */
export interface MemberPass {
  qrToken: string;
  shortCode: string;
  membership: "active" | "expired" | "none";
  expiresOn: string | null;
}

export interface Dashboard {
  club: { name: string; description: string };
  metrics: {
    members: number;
    activeMembers: number;
    upcomingEvents: number;
    balancePaise: number;
  };
  members: Member[];
  events: Event[];
  announcements: Announcement[];
  products: Product[];
  tasks: Task[];
  transactions: Transaction[];
  /** Which protected sections the caller was allowed to see. */
  access: { members: boolean; finance: boolean };
}

export interface CreateMemberInput {
  name: string;
  email: string;
}

/** Identity (#3) */
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
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
