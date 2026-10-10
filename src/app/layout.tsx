import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MODE — Your club, in sync",
  description: "A runnable student organization workspace starter for memberships, events, volunteers, and finances.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400..800;1,400..800&family=DM+Sans:wght@300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
