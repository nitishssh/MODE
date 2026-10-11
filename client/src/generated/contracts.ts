// Generated from src/lib/contracts.ts. Run npm run sync-contracts.
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

/** Publishing is immediate; reuse this key and normalized content when retrying. */
export interface PublishAnnouncementInput {
  idempotencyKey: string;
  title: string;
  body: string;
}

export interface AnnouncementPublication {
  announcement: Announcement;
  created: boolean;
  recipientCount: number;
  delivery: "simulated";
}

/** Private delivery inspection, restricted to outbox:manage holders. */
export interface AnnouncementOutboxMessage {
  id: string;
  announcementId: string;
  memberId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "simulated";
  createdAt: string;
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
  assigneeId: string | null;
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

/** Decimal MB; shared by web validation and the upload boundary. */
export const MAX_RECEIPT_SIZE_BYTES = 5_000_000;

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
  /** Optional client-generated UUID, retained with unchanged content on retry. */
  submissionId?: string;
  amountPaise: number;
  purpose: string;
  receiptId: string;
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
  kind: "income" | "expense";
  sourceType: string;
  sourceId: string | null;
  recordedBy: string | null;
  recordedByName: string | null;
}

/** Permission-scoped details of the exact record behind a ledger row. */
export interface LedgerSource {
  type: string;
  id: string;
  title: string;
  details: { label: string; value: string }[];
  receiptId: string | null;
}

// ── Event report ──────────────────────────────────────────────────────────────

export interface WorkspaceEventReport {
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
  /** `demo` is true while the fictional starter records are present (see `npm run club:init`). */
  club: { name: string; description: string; demo: boolean };
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
  token: string;
}

export interface AuthMeResponse {
  user: SessionUser;
  pass: MemberPass;
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
  announcementId: string | null;
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
