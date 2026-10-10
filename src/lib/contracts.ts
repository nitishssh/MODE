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
