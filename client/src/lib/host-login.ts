/** Staged pages carry this marker; standalone Expo dev keeps its own sign-in. */
export function hostLoginTarget(returnTo: string | null): string {
  const query = new URLSearchParams();
  if (returnTo) query.set("returnTo", returnTo);
  return `/login${query.size ? `?${query}` : ""}`;
}
