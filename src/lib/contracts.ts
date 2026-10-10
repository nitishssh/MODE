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

/** Detailed task shape retained for the task-board workflow. */
export interface TaskDetails {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  assigneeId: string | null;
  status: "todo" | "in_progress" | "done";
  eventId: string | null;
  eventTitle: string | null;
  dueAt: string | null;
  overdue: boolean;
  createdAt: string;
}

export interface PatchTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  eventId?: string | null;
  dueAt?: string | null;
}

export interface Receipt {
  id: string;
  uploaderId: string;
  uploaderName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export type ExpenseStatus = "submitted" | "approved" | "rejected" | "paid";

export interface Expense {
  id: string;
  submitterId: string;
  submitterName: string;
  amountPaise: number;
  purpose: string;
  receiptId: string | null;
  receiptReference: string | null;
  eventId: string | null;
  eventTitle: string | null;
  status: ExpenseStatus;
  rejectionNote: string | null;
  paymentReference: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
}

export interface LedgerSummary {
  inflowPaise: number;
  outflowPaise: number;
  balancePaise: number;
  approvedUnpaidPaise: number;
  byCategory: Array<{ category: string; inflowPaise: number; outflowPaise: number }>;
  byEvent: Array<{ eventId: string; eventTitle: string; inflowPaise: number; outflowPaise: number }>;
}

export interface EventReport {
  eventId: string;
  eventTitle: string;
  fundraiser: { goalPaise: number; raisedPaise: number; remainingPaise: number; percent: number; onTrack: boolean };
  tasks: { total: number; todo: number; inProgress: number; done: number; overdue: number };
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
  /** Compatibility metadata used by the existing finance workspace. */
  type: "income" | "expense_paid";
  category: string | null;
  eventId: string | null;
  eventTitle: string | null;
  reference: string | null;
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
  /** Native clients store this in secure storage; web clients use the HttpOnly cookie. */
  token: string;
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
