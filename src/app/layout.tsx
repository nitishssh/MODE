import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MODE — Your club, in sync",
  description: "A runnable student organization workspace starter for memberships, events, volunteers, and finances.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
