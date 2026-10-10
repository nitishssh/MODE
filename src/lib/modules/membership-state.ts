import { clubDate } from "../db/core";

export type MembershipState = "active" | "expired" | "none";

/**
 * The one membership rule (P0, #2). A member is active while `expiresOn` is on or
 * after the club calendar date (Asia/Kolkata); `expired` once it has passed; `none`
 * when they never had a paid period. Pricing, scanning and announcement recipients
 * must all derive from this function or its SQL twin below, never from `duesStatus`.
 */
export function membershipState(member: { expiresOn: string | null }, date: string): MembershipState {
  if (member.expiresOn === null) return "none";
  return member.expiresOn >= date ? "active" : "expired";
}

export function membershipStateNow(member: { expiresOn: string | null }, now: Date): MembershipState {
  return membershipState(member, clubDate(now));
}

/** SQL twin of `membershipState`. Bind the club date once for each `?`. */
export const MEMBERSHIP_STATE_SQL = "CASE WHEN expires_on IS NULL THEN 'none' WHEN expires_on >= ? THEN 'active' ELSE 'expired' END";

/** SQL predicate for "active today". Bind the club date. */
export const MEMBERSHIP_ACTIVE_SQL = "(expires_on IS NOT NULL AND expires_on >= ?)";
