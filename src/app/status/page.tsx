import type { Metadata } from "next";
import { StatusDashboard } from "./status-dashboard";

export const metadata: Metadata = {
  title: "MODE Status", description: "Public service health and incident updates for MODE. No account required.",
};

// Outside /app: this page must never depend on authentication or database availability.
export default function StatusPage() {
  return <StatusDashboard />;
}
