import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "./_lib/session";
import "./app.css";

export const metadata: Metadata = {
  title: "MODE workspace",
  description: "Members, events, merchandise, tasks and money for your student organization.",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
