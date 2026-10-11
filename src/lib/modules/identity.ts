import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password";
import { allocateUniqueTokens, normalizeShortCode } from "../auth/tokens";
import { membershipState } from "./membership-state";
import { clubDate } from "../db/core";
import { ROLES, hasPermission, type Permission, type Role } from "../auth/permissions";
import { SESSION_TTL_MS, generateSessionToken, hashSessionToken } from "../auth/session";
import type { CreateMemberInput, Member } from "../contracts";
import {
  DEFAULT_CLUB_ID,
} from "../db/migrations";
import {
  SQLITE_CONSTRAINT_UNIQUE,
  int,
  isConstraintError,
  nullableText,
  text,
  transaction,
  type DbContext,
  type Row,
} from "../db/core";
import {
  ConflictError,
  DuplicateMemberError,
  ForbiddenError,
  NotFoundError,
  TooManyAttemptsError,
  UnauthorizedError,
  ValidationError,
} from "../errors";

/** Login throttling (audit #10): this many consecutive failures per email lock the account for the window. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60_000;
/** Simulated outbox rows older than this are purged. */
export const OUTBOX_RETENTION_DAYS = 90;
import { createMemberSchema } from "../member-validation";

/** The authenticated caller. Every module scopes its queries to `clubId`. */
export interface Actor {
  memberId: string;
  clubId: string;
  role: Role;
  name: string;
  email: string;
  sessionId: string;
}

export interface IssuedSession {
  member: Member;
  token: string;
  expiresAt: string;
}

export const passwordSchema = z
  .string()
  .min(8, "Use a password with at least 8 characters.")
  .max(200, "Use a password with at most 200 characters.");

export const registerSchema = createMemberSchema.extend({ password: passwordSchema }).strict();
export const loginSchema = z
  .object({ email: z.string().trim().max(254).toLowerCase(), password: z.string().min(1).max(200) })
  .strict();
export const roleSchema = z.object({ role: z.enum(ROLES) }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })
  .strict();

export function mapMember(row: Row, date: string = clubDate(new Date())): Member {
  const expiresOn = nullableText(row.expires_on);
  return {
    membership: membershipState({ expiresOn }, date),
    shortCode: text(row.short_code),
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    joinedAt: text(row.joined_at),
    expiresOn: nullableText(row.expires_on),
    duesStatus: row.dues_status as Member["duesStatus"],
    role: row.role as Role,
  };
}

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) throw new ForbiddenError();
}

export function createIdentityModule(ctx: DbContext) {
  const { db } = ctx;

  function getMembers(clubId: string = DEFAULT_CLUB_ID): Member[] {
    return db
      .prepare("SELECT * FROM members WHERE club_id = ? ORDER BY joined_at DESC, name COLLATE NOCASE, id")
      .all(clubId)
      .map((row) => mapMember(row as Row, clubDate(ctx.now())));
  }

  function findMember(clubId: string, memberId: string): Member | null {
    const row = db.prepare("SELECT * FROM members WHERE club_id = ? AND id = ?").get(clubId, memberId) as Row | undefined;
    return row ? mapMember(row, clubDate(ctx.now())) : null;
  }

  function requireMember(clubId: string, memberId: string): Member {
    const member = findMember(clubId, memberId);
    if (!member) throw new NotFoundError("Member not found in this club.");
    return member;
  }

  function insertMember(
    input: CreateMemberInput & { password?: string; role?: Role; clubId?: string },
  ): Member {
    // Validate here as well so server callers cannot bypass the API boundary.
    const { name, email } = createMemberSchema.parse({ name: input.name, email: input.email });
    const member: Member = {
      id: randomUUID(),
      name,
      email,
      joinedAt: ctx.now().toISOString(),
      expiresOn: null,
      duesStatus: "unpaid",
      role: input.role ?? "member",
      membership: "none",
      shortCode: "",
    };
    const tokens = allocateUniqueTokens((candidate) => tokenExists.get(candidate.qrToken, candidate.shortCode) !== undefined);
    member.shortCode = tokens.shortCode;
    try {
      db.prepare(
        "INSERT INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash, qr_token, short_code) VALUES (?, ?, ?, ?, NULL, 'unpaid', ?, ?, ?, ?, ?)",
      ).run(
        member.id,
        member.name,
        member.email,
        member.joinedAt,
        input.clubId ?? DEFAULT_CLUB_ID,
        member.role,
        input.password ? hashPassword(input.password) : null,
        tokens.qrToken,
        tokens.shortCode,
      );
    } catch (error) {
      // The UNIQUE constraint provides the concurrency guarantee, including mixed-case email.
      if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new DuplicateMemberError();
      throw error;
    }
    return member;
  }

  // A member pass must not collide with a ticket pass either: the scanner resolves tickets first (audit #15).
  const tokenExists = {
    get: (qrToken: string, shortCode: string) =>
      db.prepare("SELECT 1 FROM members WHERE qr_token = ? OR short_code = ?").get(qrToken, shortCode) ??
      db.prepare("SELECT 1 FROM tickets WHERE qr_token = ? OR short_code = ?").get(qrToken, shortCode),
  };

  /** The member's own pass: QR token plus typed fallback and today's membership state. */
  function getPass(memberId: string) {
    const row = db.prepare("SELECT qr_token, short_code, expires_on FROM members WHERE id = ?").get(memberId) as Row | undefined;
    if (!row) throw new NotFoundError("Member not found.");
    const expiresOn = nullableText(row.expires_on);
    return { qrToken: text(row.qr_token), shortCode: text(row.short_code), membership: membershipState({ expiresOn }, clubDate(ctx.now())), expiresOn };
  }

  /** Door resolution by QR token or typed short code; never by sequential id. */
  function findMemberByPass(clubId: string, credential: string): Member | null {
    const trimmed = credential.trim();
    const row = db
      .prepare("SELECT * FROM members WHERE club_id = ? AND (qr_token = ? OR short_code = ?)")
      .get(clubId, trimmed, normalizeShortCode(trimmed)) as Row | undefined;
    return row ? mapMember(row, clubDate(ctx.now())) : null;
  }

  /** Officer-created member record without login credentials. */
  function createMember(input: CreateMemberInput, options: { clubId?: string } = {}): Member {
    return insertMember({ ...input, clubId: options.clubId });
  }

  /** Officer creates a member in their own club; the record and its audit entry commit together. */
  function createMemberAs(actor: Actor, input: CreateMemberInput): Member {
    assertPermission(actor, "members:create");
    return transaction(ctx, () => {
      const member = insertMember({ ...input, clubId: actor.clubId });
      recordAudit(actor, "member.created", "member", member.id);
      return member;
    });
  }

  function issueSession(member: Member, clubId: string): IssuedSession {
    const token = generateSessionToken();
    const createdAt = ctx.now();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS).toISOString();
    db.prepare(
      "INSERT INTO sessions (id, club_id, member_id, token_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    ).run(randomUUID(), clubId, member.id, hashSessionToken(token), createdAt.toISOString(), expiresAt);
    return { member, token, expiresAt };
  }

  /** Self-service sign-up. New accounts always start as plain members of the default club. */
  function register(input: { name: string; email: string; password: string }): IssuedSession {
    const parsed = registerSchema.parse(input);
    return transaction(ctx, () => {
      const member = insertMember({ ...parsed, role: "member", clubId: DEFAULT_CLUB_ID });
      return issueSession(member, DEFAULT_CLUB_ID);
    });
  }

  function recordLoginFailure(email: string): void {
    transaction(ctx, () => {
      const now = ctx.now();
      const previous = db.prepare("SELECT failures FROM login_attempts WHERE email = ?").get(email) as Row | undefined;
      const failures = int(previous?.failures ?? 0) + 1;
      const lock = failures >= LOGIN_MAX_FAILURES;
      db.prepare(
        "INSERT INTO login_attempts (email, failures, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO UPDATE SET failures = excluded.failures, locked_until = excluded.locked_until, updated_at = excluded.updated_at",
      ).run(email, lock ? 0 : failures, lock ? new Date(now.getTime() + LOGIN_LOCKOUT_MS).toISOString() : null, now.toISOString());
    });
  }

  function login(input: { email: string; password: string }): IssuedSession {
    const parsed = loginSchema.parse(input);
    const nowIso = ctx.now().toISOString();
    const attempt = db.prepare("SELECT locked_until FROM login_attempts WHERE email = ?").get(parsed.email) as Row | undefined;
    const lockedUntil = nullableText(attempt?.locked_until ?? null);
    if (lockedUntil && lockedUntil > nowIso) throw new TooManyAttemptsError(lockedUntil);
    const row = db.prepare("SELECT * FROM members WHERE email = ?").get(parsed.email) as Row | undefined;
    // Unknown accounts must run the dummy derivation too; avoid short-circuiting it.
    const passwordMatches = verifyPassword(parsed.password, row ? nullableText(row.password_hash) : null);
    // Same error for unknown email and wrong password; both count towards the lockout.
    if (!row || !passwordMatches) {
      recordLoginFailure(parsed.email);
      throw new UnauthorizedError("Incorrect email or password.");
    }
    return transaction(ctx, () => {
      db.prepare("DELETE FROM login_attempts WHERE email = ?").run(parsed.email);
      return issueSession(mapMember(row), text(row.club_id));
    });
  }

  function revokeSessions(memberId: string, exceptSessionId?: string): number {
    const nowIso = ctx.now().toISOString();
    return exceptSessionId
      ? Number(db.prepare("UPDATE sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL AND id <> ?").run(nowIso, memberId, exceptSessionId).changes)
      : Number(db.prepare("UPDATE sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").run(nowIso, memberId).changes);
  }

  /** Self-service password change (audit #9): proves the current password, keeps this session, signs out every other one. */
  function changePassword(actor: Actor, input: { currentPassword: string; newPassword: string }): { revokedSessions: number } {
    const parsed = changePasswordSchema.parse(input);
    const row = db.prepare("SELECT password_hash FROM members WHERE id = ?").get(actor.memberId) as Row | undefined;
    if (!row || !verifyPassword(parsed.currentPassword, nullableText(row.password_hash))) throw new UnauthorizedError("The current password is incorrect.");
    return transaction(ctx, () => {
      db.prepare("UPDATE members SET password_hash = ? WHERE id = ?").run(hashPassword(parsed.newPassword), actor.memberId);
      const revokedSessions = revokeSessions(actor.memberId, actor.sessionId);
      recordAudit(actor, "member.password_changed", "member", actor.memberId, { revokedSessions });
      return { revokedSessions };
    });
  }

  /** Maintenance (audit #12): expired/revoked sessions, stale login counters and old simulated outbox rows. */
  function purge(): { sessions: number; loginAttempts: number; outbox: number } {
    const now = ctx.now();
    const nowIso = now.toISOString();
    return transaction(ctx, () => ({
      sessions: Number(db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").run(nowIso).changes),
      loginAttempts: Number(db.prepare("DELETE FROM login_attempts WHERE (locked_until IS NULL OR locked_until <= ?) AND updated_at <= ?").run(nowIso, new Date(now.getTime() - LOGIN_LOCKOUT_MS).toISOString()).changes),
      outbox: Number(db.prepare("DELETE FROM outbox_messages WHERE status = 'simulated' AND created_at <= ?").run(new Date(now.getTime() - OUTBOX_RETENTION_DAYS * 86_400_000).toISOString()).changes),
    }));
  }

  function logout(token: string | null): void {
    if (!token) return;
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(
      ctx.now().toISOString(),
      hashSessionToken(token),
    );
  }

  /** Resolve a session token to an actor; expired or revoked sessions are treated as signed out. */
  function getActor(token: string | null): Actor | null {
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT s.id AS session_id, s.expires_at, m.id, m.club_id, m.role, m.name, m.email
         FROM sessions s JOIN members m ON m.id = s.member_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL`,
      )
      .get(hashSessionToken(token)) as Row | undefined;
    if (!row || text(row.expires_at) <= ctx.now().toISOString()) return null;
    return {
      sessionId: text(row.session_id),
      memberId: text(row.id),
      clubId: text(row.club_id),
      role: row.role as Role,
      name: text(row.name),
      email: text(row.email),
    };
  }

  function recordAudit(
    actor: Actor | null,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown>,
    clubId: string = actor?.clubId ?? DEFAULT_CLUB_ID,
  ): void {
    db.prepare(
      "INSERT INTO audit_events (id, club_id, actor_id, action, entity_type, entity_id, details, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      randomUUID(),
      clubId,
      actor?.memberId ?? null,
      action,
      entityType,
      entityId,
      details ? JSON.stringify(details) : null,
      ctx.now().toISOString(),
    );
  }

  /** Admins/leads assign roles inside their own club. Changing your own role is rejected. */
  function setRole(actor: Actor, memberId: string, role: Role): Member {
    assertPermission(actor, "roles:manage");
    if (!ROLES.includes(role)) throw new ValidationError("Unknown role.");
    if (memberId === actor.memberId) throw new ConflictError("You cannot change your own role.", "self_role_change");
    return transaction(ctx, () => {
      const before = requireMember(actor.clubId, memberId);
      db.prepare("UPDATE members SET role = ? WHERE id = ? AND club_id = ?").run(role, memberId, actor.clubId);
      recordAudit(actor, "member.role_changed", "member", memberId, { from: before.role, to: role });
      return { ...before, role };
    });
  }

  /** Lets an admin grant credentials to an officer-created member. */
  function setPassword(actor: Actor, memberId: string, password: string): void {
    assertPermission(actor, "roles:manage");
    passwordSchema.parse(password);
    transaction(ctx, () => {
      requireMember(actor.clubId, memberId);
      db.prepare("UPDATE members SET password_hash = ? WHERE id = ? AND club_id = ?").run(hashPassword(password), memberId, actor.clubId);
      // A reset credential signs the member out everywhere (audit #8).
      const revokedSessions = revokeSessions(memberId);
      recordAudit(actor, "member.password_set", "member", memberId, { revokedSessions });
    });
  }

  /** Club record as shown in the workspace, plus whether it still holds the fictional seed. */
  function getClub(clubId: string = DEFAULT_CLUB_ID): { id: string; name: string; description: string; annualDuesPaise: number; demo: boolean } | null {
    const row = db.prepare("SELECT id, name, description, annual_dues_paise FROM clubs WHERE id = ?").get(clubId) as Row | undefined;
    if (!row) return null;
    const demo = db.prepare("SELECT 1 FROM members WHERE club_id = ? AND id = 'demo-officer-admin'").get(clubId) !== undefined;
    return { id: text(row.id), name: text(row.name), description: text(row.description), annualDuesPaise: int(row.annual_dues_paise), demo };
  }

  /** Tooling (`npm run club:init`): rename the club and set its annual dues without touching members. */
  function updateClub(clubId: string, input: { name?: string; description?: string; annualDuesPaise?: number }): void {
    const current = getClub(clubId);
    if (!current) throw new NotFoundError("Club not found.");
    const name = input.name === undefined ? current.name : z.string().trim().min(2).max(120).parse(input.name);
    const description = input.description === undefined ? current.description : z.string().trim().max(500).parse(input.description);
    const dues = input.annualDuesPaise === undefined ? current.annualDuesPaise : z.number().int().positive().parse(input.annualDuesPaise);
    db.prepare("UPDATE clubs SET name = ?, description = ?, annual_dues_paise = ? WHERE id = ?").run(name, description, dues, clubId);
  }

  /**
   * Tooling (`npm run club:import`): bring an existing register in. A member with `expiresOn`
   * arrives as already paid up to that club date; no ledger row is posted because the money
   * was collected before MODE. Returns null when the email already exists.
   */
  function importMember(
    input: { name: string; email: string; role?: Role; expiresOn?: string | null; password?: string },
    clubId: string = DEFAULT_CLUB_ID,
  ): Member | null {
    if (input.role && !ROLES.includes(input.role)) throw new ValidationError(`Unknown role: ${input.role}`);
    if (input.expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) throw new ValidationError("expiresOn must be YYYY-MM-DD.");
    if (input.password) passwordSchema.parse(input.password);
    return transaction(ctx, () => {
      let member: Member;
      try {
        member = insertMember({ name: input.name, email: input.email, role: input.role ?? "member", password: input.password, clubId });
      } catch (error) {
        if (error instanceof DuplicateMemberError) return null;
        throw error;
      }
      if (input.expiresOn) {
        db.prepare("UPDATE members SET expires_on = ?, dues_status = 'paid' WHERE id = ?").run(input.expiresOn, member.id);
        return findMember(clubId, member.id);
      }
      return member;
    });
  }

  /** Test and tooling helper; the starter runs a single club. */
  function createClub(name: string): string {
    const id = `club-${randomUUID()}`;
    db.prepare("INSERT INTO clubs (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(id, name, "", ctx.now().toISOString());
    return id;
  }

  function createMemberWithCredentials(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    clubId?: string;
  }): Member {
    return insertMember(input);
  }

  function listAudit(actor: Actor, entityType?: string) {
    assertPermission(actor, "roles:manage");
    const rows = entityType
      ? db.prepare("SELECT * FROM audit_events WHERE club_id = ? AND entity_type = ? ORDER BY occurred_at DESC").all(actor.clubId, entityType)
      : db.prepare("SELECT * FROM audit_events WHERE club_id = ? ORDER BY occurred_at DESC").all(actor.clubId);
    return (rows as Row[]).map((row) => ({
      id: text(row.id),
      actorId: nullableText(row.actor_id),
      action: text(row.action),
      entityType: text(row.entity_type),
      entityId: text(row.entity_id),
      details: row.details === null ? null : (JSON.parse(text(row.details)) as Record<string, unknown>),
      occurredAt: text(row.occurred_at),
    }));
  }

  return {
    getPass,
    findMemberByPass,
    getMembers,
    findMember,
    requireMember,
    createMember,
    createMemberAs,
    createMemberWithCredentials,
    register,
    login,
    changePassword,
    purge,
    logout,
    getActor,
    setRole,
    setPassword,
    recordAudit,
    listAudit,
    createClub,
    getClub,
    updateClub,
    importMember,
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
