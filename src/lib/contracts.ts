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

/** Membership lifecycle (#4) */
export interface MembershipPlan {
  id: string;
  name: string;
  pricePaise: number;
  durationDays: number;
  grantsMemberPricing: boolean;
}

export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  planName: string;
  startsOn: string;
  expiresOn: string;
  paymentId: string | null;
  grantsMemberPricing: boolean;
}

export interface MembershipStatus {
  memberId: string;
  active: boolean;
  memberPricing: boolean;
  expiresOn: string | null;
  current: Membership | null;
  history: Membership[];
}

export interface Payment {
  id: string;
  memberId: string;
  purpose: "membership" | "ticket" | "order";
  targetId: string;
  reference: string;
  amountPaise: number;
  recordedAt: string;
}

/** Outbox: recorded delivery attempts. `previewed` is a local demo, never a real send. */
export interface OutboxMessage {
  id: string;
  kind: string;
  recipient: string;
  subject: string;
  status: "pending" | "previewed" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

/** Event booking and ticket check-in (#5) */
export interface EventDetails extends Event {
  description: string;
  status: "draft" | "published" | "cancelled";
  /** Seats still bookable: capacity minus held (reserved + confirmed) seats. */
  available: number;
}

export interface Booking {
  id: string;
  eventId: string;
  memberId: string;
  pricePaise: number;
  pricing: "member" | "guest";
  status: "reserved" | "confirmed" | "cancelled" | "expired";
  paymentId: string | null;
  /** Issued only once the booking is confirmed (paid or free). */
  ticketCode: string | null;
  reservedUntil: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventReport {
  event: EventDetails;
  bookings: { reserved: number; confirmed: number; cancelled: number; expired: number };
  checkedIn: number;
  incomePaise: number;
  attendees: Array<{ memberId: string; name: string; pricing: "member" | "guest"; checkedInAt: string | null }>;
}
