import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Membership, MembershipPlan, MembershipStatus, Payment } from "../contracts";
import { addDays, clubDate, int, nullableText, text, transaction, type DbContext, type Row } from "../db/core";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { assertPermission, type Actor, type IdentityModule } from "./identity";
import type { LedgerModule } from "./ledger";
import type { OutboxModule } from "./outbox";
import { parseInput } from "../validation";

export const recordDuesSchema = z
  .object({
    memberId: z.string().min(1),
    planId: z.string().min(1),
    paymentReference: z.string().trim().min(3).max(120).optional(),
    amountPaise: z.number().int().positive().optional(),
  })
  .strict();

export const reminderRunSchema = z.object({ daysAhead: z.number().int().min(0).max(365).default(14) }).strict();

function mapPlan(row: Row): MembershipPlan {
  return {
    id: text(row.id),
    name: text(row.name),
    pricePaise: int(row.price_paise),
    durationDays: int(row.duration_days),
    grantsMemberPricing: int(row.grants_member_pricing) === 1,
  };
}

function mapMembership(row: Row): Membership {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    planId: text(row.plan_id),
    planName: text(row.plan_name),
    startsOn: text(row.starts_on),
    expiresOn: text(row.expires_on),
    paymentId: nullableText(row.payment_id),
    grantsMemberPricing: int(row.grants_member_pricing) === 1,
  };
}

export function mapPayment(row: Row): Payment {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    purpose: row.purpose as Payment["purpose"],
    targetId: text(row.target_id),
    reference: text(row.reference),
    amountPaise: int(row.amount_paise),
    recordedAt: text(row.recorded_at),
  };
}

export function createMembershipModule(
  ctx: DbContext,
  identity: IdentityModule,
  ledger: LedgerModule,
  outbox: OutboxModule,
) {
  const { db } = ctx;

  function listPlans(clubId: string): MembershipPlan[] {
    return (db.prepare("SELECT * FROM membership_plans WHERE club_id = ? AND active = 1 ORDER BY price_paise, name").all(clubId) as Row[]).map(mapPlan);
  }

  function requirePlan(clubId: string, planId: string): MembershipPlan {
    const row = db.prepare("SELECT * FROM membership_plans WHERE club_id = ? AND id = ? AND active = 1").get(clubId, planId) as Row | undefined;
    if (!row) throw new NotFoundError("Membership plan not found.");
    return mapPlan(row);
  }

  function history(clubId: string, memberId: string): Membership[] {
    return (
      db
        .prepare(
          `SELECT ms.*, p.name AS plan_name, p.grants_member_pricing
           FROM memberships ms JOIN membership_plans p ON p.id = ms.plan_id
           WHERE ms.club_id = ? AND ms.member_id = ? ORDER BY ms.expires_on DESC, ms.created_at DESC`,
        )
        .all(clubId, memberId) as Row[]
    ).map(mapMembership);
  }

  /**
   * The membership rule shared by tickets and merchandise: a member is active when
   * the club calendar day falls inside a membership period, and gets member pricing
   * only when that plan grants it. Expired members fall back to guest pricing.
   */
  function statusFor(clubId: string, memberId: string, at: Date = ctx.now()): MembershipStatus {
    const today = clubDate(at);
    const all = history(clubId, memberId);
    const current = all.find((item) => item.startsOn <= today && today <= item.expiresOn) ?? null;
    const latest = all[0] ?? null;
    return {
      memberId,
      active: current !== null,
      memberPricing: current !== null && current.grantsMemberPricing,
      expiresOn: latest?.expiresOn ?? null,
      current,
      history: all,
    };
  }

  function findPayment(clubId: string, reference: string): Payment | null {
    const row = db.prepare("SELECT * FROM payments WHERE club_id = ? AND reference = ?").get(clubId, reference) as Row | undefined;
    return row ? mapPayment(row) : null;
  }

  /**
   * Record a payment reference exactly once. Replaying the same reference for the
   * same purpose and member returns the original payment; reusing it elsewhere is a conflict.
   */
  function recordPayment(input: {
    clubId: string;
    memberId: string;
    purpose: Payment["purpose"];
    targetId: string;
    reference: string;
    amountPaise: number;
    recordedBy: string | null;
  }): { payment: Payment; created: boolean } {
    const existing = findPayment(input.clubId, input.reference);
    if (existing) {
      if (existing.memberId === input.memberId && existing.purpose === input.purpose && existing.amountPaise === input.amountPaise) {
        return { payment: existing, created: false };
      }
      throw new ConflictError("This payment reference has already been used for a different transaction.", "payment_reference_reused");
    }
    const payment: Payment = {
      id: randomUUID(),
      memberId: input.memberId,
      purpose: input.purpose,
      targetId: input.targetId,
      reference: input.reference,
      amountPaise: input.amountPaise,
      recordedAt: ctx.now().toISOString(),
    };
    db.prepare(
      "INSERT INTO payments (id, club_id, member_id, purpose, target_id, reference, amount_paise, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(payment.id, input.clubId, payment.memberId, payment.purpose, payment.targetId, payment.reference, payment.amountPaise, input.recordedBy, payment.recordedAt);
    return { payment, created: true };
  }

  /** Officer records dues (or a free enrolment). Renewal extends validity from the current expiry. */
  function recordDues(actor: Actor, input: z.infer<typeof recordDuesSchema>) {
    assertPermission(actor, "membership:record_payment");
    const data = parseInput(recordDuesSchema, input);
    return transaction(ctx, () => {
      const member = identity.requireMember(actor.clubId, data.memberId);
      const plan = requirePlan(actor.clubId, data.planId);
      const today = clubDate(ctx.now());
      const status = statusFor(actor.clubId, member.id);

      let payment: Payment | null = null;
      if (plan.pricePaise > 0) {
        if (!data.paymentReference) throw new ValidationError("A payment reference is required for a paid plan.", [{ field: "paymentReference", message: "Required." }]);
        if (data.amountPaise !== plan.pricePaise) {
          throw new ValidationError(`This plan costs ${plan.pricePaise} paise.`, [{ field: "amountPaise", message: `Expected ${plan.pricePaise}.` }]);
        }
        const recorded = recordPayment({
          clubId: actor.clubId,
          memberId: member.id,
          purpose: "membership",
          targetId: plan.id,
          reference: data.paymentReference,
          amountPaise: plan.pricePaise,
          recordedBy: actor.memberId,
        });
        payment = recorded.payment;
        if (!recorded.created) {
          // Duplicate confirmation: return the membership this payment already created, credit nothing.
          const row = db
            .prepare(
              `SELECT ms.*, p.name AS plan_name, p.grants_member_pricing FROM memberships ms JOIN membership_plans p ON p.id = ms.plan_id WHERE ms.payment_id = ?`,
            )
            .get(payment.id) as Row | undefined;
          if (row) return { membership: mapMembership(row), payment, created: false, status: statusFor(actor.clubId, member.id) };
        }
      } else if (status.current && status.current.planId === plan.id) {
        throw new ConflictError("This member already holds an active membership on this plan.", "duplicate_membership");
      }

      // Deterministic renewal: continue from the day after the latest expiry when still valid.
      const latest = status.history[0];
      const startsOn = latest && latest.expiresOn >= today ? addDays(latest.expiresOn, 1) : today;
      const expiresOn = addDays(startsOn, plan.durationDays);
      const membershipId = randomUUID();
      db.prepare("INSERT INTO memberships VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        membershipId,
        actor.clubId,
        member.id,
        plan.id,
        startsOn,
        expiresOn,
        payment?.id ?? null,
        ctx.now().toISOString(),
      );
      db.prepare("UPDATE members SET dues_status = ?, expires_on = ? WHERE id = ?").run(plan.pricePaise > 0 ? "paid" : member.duesStatus, expiresOn, member.id);
      if (payment) {
        ledger.postEntry({
          clubId: actor.clubId,
          kind: "income",
          category: "membership",
          amountPaise: payment.amountPaise,
          description: `Membership dues · ${plan.name} · ${member.name}`,
          source: { type: "payment", id: payment.id },
          memberId: member.id,
        });
      }
      identity.recordAudit(actor, "membership.recorded", "membership", membershipId, {
        memberId: member.id,
        planId: plan.id,
        startsOn,
        expiresOn,
        paymentId: payment?.id ?? null,
      });
      const membership = history(actor.clubId, member.id).find((item) => item.id === membershipId)!;
      return { membership, payment, created: true, status: statusFor(actor.clubId, member.id) };
    });
  }

  /**
   * Queue one renewal reminder per membership that ends within `daysAhead` club days
   * and has not been superseded. The dedupe key makes repeated runs a no-op.
   */
  function runRenewalReminders(actor: Actor, input: { daysAhead?: number } = {}) {
    assertPermission(actor, "membership:reminders");
    const { daysAhead } = parseInput(reminderRunSchema, input);
    const today = clubDate(ctx.now());
    const horizon = addDays(today, daysAhead);
    const rows = db
      .prepare(
        `SELECT ms.id, ms.member_id, ms.expires_on, m.name, m.email, p.name AS plan_name
         FROM memberships ms
         JOIN members m ON m.id = ms.member_id
         JOIN membership_plans p ON p.id = ms.plan_id
         WHERE ms.club_id = ? AND ms.expires_on BETWEEN ? AND ?
           AND NOT EXISTS (
             SELECT 1 FROM memberships later WHERE later.member_id = ms.member_id AND later.starts_on > ms.expires_on
           )
         ORDER BY ms.expires_on, ms.id`,
      )
      .all(actor.clubId, today, horizon) as Row[];
    let created = 0;
    let skipped = 0;
    transaction(ctx, () => {
      for (const row of rows) {
        const queued = outbox.enqueue({
          clubId: actor.clubId,
          kind: "membership_renewal",
          recipientMemberId: text(row.member_id),
          recipientEmail: text(row.email),
          subject: `Your ${text(row.plan_name)} membership ends on ${text(row.expires_on)}`,
          body: `Hi ${text(row.name)}, your membership ends on ${text(row.expires_on)}. Renew to keep member pricing and benefits.`,
          dedupeKey: `renewal:${text(row.id)}`,
        });
        if (queued) created += 1;
        else skipped += 1;
      }
    });
    return { asOf: today, horizon, candidates: rows.length, created, skipped };
  }

  return { listPlans, requirePlan, statusFor, history, recordDues, recordPayment, findPayment, runRenewalReminders };
}

export type MembershipModule = ReturnType<typeof createMembershipModule>;
