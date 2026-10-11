import type { ReactNode } from "react";

/** Auth screens share the workspace paper and type (app.css); no shell around them. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
