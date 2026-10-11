/**
 * Sample imagery for the workspace chrome: a club crest and one illustrated
 * avatar per role, drawn in the product palette (public/avatars/*.svg).
 * Real clubs will replace these with uploads later; until then every member
 * shows the picture of their role so the directory and the sidebar read at a
 * glance.
 */

export type AvatarRole = "admin" | "organizer" | "treasurer" | "volunteer" | "member";

export const CLUB_CREST = "/avatars/club.svg";

export function roleAvatar(role: string | null | undefined): string {
  const known: AvatarRole[] = ["admin", "organizer", "treasurer", "volunteer", "member"];
  return `/avatars/${known.includes(role as AvatarRole) ? role : "member"}.svg`;
}
