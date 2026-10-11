import type { ReactNode } from "react";
import "@/components/login-page.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
