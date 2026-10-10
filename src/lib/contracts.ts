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
  membership: "active" | "expired" | "none";
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

/** Basic task shape used by the dashboard overview. */
export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: "todo" | "in_progress" | "done";
}

/** Detailed task shape used by the full task board (issue #13). */
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

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeId?: string;
  eventId?: string;
  dueAt?: string;
}

export interface PatchTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  eventId?: string | null;
  dueAt?: string | null;
}

export interface UpdateTaskStatusInput {
  status: "todo" | "in_progress" | "done";
}

export interface Transaction {
  id: string;
  description: string;
  kind: "income" | "expense";
  amountPaise: number;
  occurredAt: string;
}

// ── Receipt ──────────────────────────────────────────────────────────────────

export interface Receipt {
  id: string;
  uploaderId: string;
  uploaderName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// ── Expense ───────────────────────────────────────────────────────────────────

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

export interface SubmitExpenseInput {
  amountPaise: number;
  purpose: string;
  receiptId?: string;
  receiptReference?: string;
  eventId?: string;
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export interface LedgerSummary {
  inflowPaise: number;
  outflowPaise: number;
  balancePaise: number;
  approvedUnpaidPaise: number;
  byCategory: { category: string; inflowPaise: number; outflowPaise: number }[];
  byEvent: { eventId: string; eventTitle: string; inflowPaise: number; outflowPaise: number }[];
}

export interface ExpenseLedgerEntry {
  id: string;
  type: "income" | "expense_paid";
  description: string;
  amountPaise: number;
  category: string | null;
  eventId: string | null;
  eventTitle: string | null;
  reference: string | null;
  occurredAt: string;
}

// ── Event report ──────────────────────────────────────────────────────────────

export interface EventReport {
  eventId: string;
  eventTitle: string;
  fundraiser: {
    goalPaise: number;
    raisedPaise: number;
    remainingPaise: number;
    percent: number;
    onTrack: boolean;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
  access: { members: boolean; finance: boolean };
}

export interface CreateMemberInput {
  name: string;
  email: string;
}

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
  token?: string;
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

export interface LedgerEntry extends Transaction {
  sourceType: string | null;
  sourceId: string | null;
  recordedBy: string | null;
}
