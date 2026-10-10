import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password";
import { ROLES, hasPermission, type Permission, type Role } from "../auth/permissions";
import { SESSION_TTL_MS, generateSessionToken, hashSessionToken } from "../auth/session";
import type { CreateMemberInput, Member } from "../contracts";
import {
  DEFAULT_CLUB_ID,
} from "../db/migrations";
import {
  SQLITE_CONSTRAINT_UNIQUE,
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
  UnauthorizedError,
  ValidationError,
} from "../errors";
import { createMemberSchema } from "../member-validation";
import { parseInput } from "../validation";

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

export function mapMember(row: Row): Member {
  return {
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
      .map(mapMember);
  }

  function findMember(clubId: string, memberId: string): Member | null {
    const row = db.prepare("SELECT * FROM members WHERE club_id = ? AND id = ?").get(clubId, memberId) as Row | undefined;
    return row ? mapMember(row) : null;
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
    const { name, email } = parseInput(createMemberSchema, { name: input.name, email: input.email });
    const member: Member = {
      id: randomUUID(),
      name,
      email,
      joinedAt: ctx.now().toISOString(),
      expiresOn: null,
      duesStatus: "unpaid",
      role: input.role ?? "member",
    };
    try {
      db.prepare(
        "INSERT INTO members (id, name, email, joined_at, expires_on, dues_status, club_id, role, password_hash) VALUES (?, ?, ?, ?, NULL, 'unpaid', ?, ?, ?)",
      ).run(
        member.id,
        member.name,
        member.email,
        member.joinedAt,
        input.clubId ?? DEFAULT_CLUB_ID,
        member.role,
        input.password ? hashPassword(input.password) : null,
      );
    } catch (error) {
      // The UNIQUE constraint provides the concurrency guarantee, including mixed-case email.
      if (isConstraintError(error, SQLITE_CONSTRAINT_UNIQUE)) throw new DuplicateMemberError();
      throw error;
    }
    return member;
  }

  /** Officer-created member record without login credentials. */
  function createMember(input: CreateMemberInput, options: { clubId?: string } = {}): Member {
    return insertMember({ ...input, clubId: options.clubId });
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
    const parsed = parseInput(registerSchema, input);
    return transaction(ctx, () => {
      const member = insertMember({ ...parsed, role: "member", clubId: DEFAULT_CLUB_ID });
      return issueSession(member, DEFAULT_CLUB_ID);
    });
  }

  function login(input: { email: string; password: string }): IssuedSession {
    const parsed = parseInput(loginSchema, input);
    const row = db.prepare("SELECT * FROM members WHERE email = ?").get(parsed.email) as Row | undefined;
    // Same error for unknown email and wrong password.
    if (!row || !verifyPassword(parsed.password, nullableText(row.password_hash))) {
      throw new UnauthorizedError("Incorrect email or password.");
    }
    return transaction(ctx, () => issueSession(mapMember(row), text(row.club_id)));
  }

  function logout(token: string | null): void {
    if (!token) return;
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(
      ctx.now().toISOString(),
      hashSessionToken(token),
    );
  }

  /** Resolve a cookie token to an actor; expired or revoked sessions are treated as signed out. */
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
    parseInput(passwordSchema, password);
    transaction(ctx, () => {
      requireMember(actor.clubId, memberId);
      db.prepare("UPDATE members SET password_hash = ? WHERE id = ? AND club_id = ?").run(hashPassword(password), memberId, actor.clubId);
      recordAudit(actor, "member.password_set", "member", memberId);
    });
  }

  /** Test and tooling helper; the starter runs a single club. */
  function createClub(name: string): string {
    const id = `club-${randomUUID()}`;
    db.prepare("INSERT INTO clubs VALUES (?, ?, ?, ?)").run(id, name, "", ctx.now().toISOString());
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
      ? db.prepare("SELECT * FROM audit_events WHERE club_id = ? AND entity_type = ? ORDER BY occurred_at DESC, rowid DESC").all(actor.clubId, entityType)
      : db.prepare("SELECT * FROM audit_events WHERE club_id = ? ORDER BY occurred_at DESC, rowid DESC").all(actor.clubId);
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
    getMembers,
    findMember,
    requireMember,
    createMember,
    createMemberWithCredentials,
    register,
    login,
    logout,
    getActor,
    setRole,
    setPassword,
    recordAudit,
    listAudit,
    createClub,
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
