import { Link, Redirect } from "expo-router";
import type { SessionUser } from "../generated/contracts";
import { Copy, Screen } from "../components/ui";
import { overviewPath } from "./navigation";
import { resolveReturnTarget } from "./return-target";

export function ForbiddenPage() {
  return (
    <Screen title="Access denied">
      <Copy accessibilityRole="alert">
        Your current club permissions do not allow access to this page.
      </Copy>
      <Link replace href={overviewPath}>Go to overview</Link>
    </Screen>
  );
}

export function AuthRedirect({ user, returnTo }: { user: SessionUser; returnTo: unknown }) {
  const destination = resolveReturnTarget(user, returnTo);
  // Redirect uses replace, so login/registration cannot form a Back-button loop.
  return destination.allowed ? <Redirect href={destination.href} /> : <ForbiddenPage />;
}
