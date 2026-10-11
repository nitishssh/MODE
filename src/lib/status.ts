import { z } from "zod";

export const SERVICE_CATALOG = [
  { id: "api", name: "API", description: "The public status endpoint can respond to requests.", monitored: true },
  { id: "database", name: "Database", description: "A lightweight database query completes successfully.", monitored: true },
  { id: "auth", name: "Sign-in & accounts", description: "Reads account/session storage and signs then verifies a temporary token without creating a login session.", monitored: true },
  { id: "events", name: "Events & tickets", description: "Reads the event and ticket tables in the configured database.", monitored: true },
  { id: "memberships", name: "Memberships", description: "Reads member and dues-payment storage without returning personal records.", monitored: true },
  { id: "merchandise", name: "Merchandise", description: "Reads product, stock-variant and merchandise-order storage.", monitored: true },
  { id: "receipts", name: "Receipt storage", description: "Reads receipt metadata and writes, reads back and removes a temporary file in the configured receipt directory.", monitored: true },
] as const;

export type ServiceId = typeof SERVICE_CATALOG[number]["id"];
const serviceId = z.enum(["api", "database", "auth", "events", "memberships", "merchandise", "receipts"]);
export const statusState = z.enum(["operational", "degraded", "partial_outage", "major_outage", "maintenance", "unknown"]);
export type StatusState = z.infer<typeof statusState>;
export const STATUS_LABELS: Record<StatusState, string> = {
  operational: "Operational", degraded: "Degraded performance", partial_outage: "Partial outage",
  major_outage: "Major outage", maintenance: "Under maintenance", unknown: "Not monitored",
};
export const STALE_AFTER_MS = 30_000;

const updateSchema = z.object({
  at: z.iso.datetime(),
  stage: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  message: z.string().min(1).max(2000),
});
export const incidentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1).max(160),
  services: z.array(serviceId).min(1),
  impact: z.enum(["degraded", "partial_outage", "major_outage"]),
  updates: z.array(updateSchema).min(1),
}).refine(incident => incident.updates.every((update, i) => i === 0 || Date.parse(update.at) >= Date.parse(incident.updates[i - 1].at)), {
  message: "Incident updates must be ordered oldest first.",
});
export const maintenanceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1).max(160),
  description: z.string().min(1).max(2000), services: z.array(serviceId).min(1),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
}).refine(item => Date.parse(item.endsAt) > Date.parse(item.startsAt), { message: "Maintenance must end after it starts." });
export const statusNoticesSchema = z.object({
  incidents: z.array(incidentSchema), maintenance: z.array(maintenanceSchema),
});
export type StatusNotices = z.infer<typeof statusNoticesSchema>;
export type StatusIncident = z.infer<typeof incidentSchema>;

export const snapshotSchema = z.object({
  checkedAt: z.iso.datetime(),
  serverUptimeSeconds: z.number().nonnegative().optional(),
  services: z.array(z.object({
    id: serviceId, state: statusState, latencyMs: z.number().nonnegative().nullable(),
    detail: z.string().max(240).optional(),
  })).length(SERVICE_CATALOG.length).refine(services => new Set(services.map(s => s.id)).size === SERVICE_CATALOG.length),
  notices: statusNoticesSchema,
});
export type StatusSnapshot = z.infer<typeof snapshotSchema>;

export function activeIncidents(notices: StatusNotices, now = Date.now()) {
  return notices.incidents.filter(incident => {
    const updates = incident.updates.filter(update => Date.parse(update.at) <= now);
    return updates.length > 0 && updates.at(-1)!.stage !== "resolved";
  });
}

const severity: Record<StatusState, number> = {
  unknown: 0, operational: 1, maintenance: 2, degraded: 3, partial_outage: 4, major_outage: 5,
};

/** Published incidents can worsen an automatic result, never conceal an outage. */
export function serviceState(id: ServiceId, observed: StatusState, notices: StatusNotices, now: number): StatusState {
  let state = observed;
  if (notices.maintenance.some(item => item.services.includes(id) && Date.parse(item.startsAt) <= now && Date.parse(item.endsAt) > now)) {
    if (severity.maintenance > severity[state]) state = "maintenance";
  }
  for (const incident of activeIncidents(notices, now)) {
    if (incident.services.includes(id) && severity[incident.impact] > severity[state]) state = incident.impact;
  }
  return state;
}

export function isFresh(snapshot: StatusSnapshot | null, now: number): boolean {
  if (!snapshot) return false;
  const age = now - Date.parse(snapshot.checkedAt);
  return age >= -30_000 && age <= STALE_AFTER_MS;
}

export function statusOverview(snapshot: StatusSnapshot | null, fresh: boolean) {
  if (!snapshot || !fresh) return { state: "unknown" as StatusState, title: "Live status is unavailable", description: "We could not confirm the latest service health. Please try refreshing." };
  const worst = snapshot.services.reduce<StatusState>((state, service) => severity[service.state] > severity[state] ? service.state : state, "unknown");
  if (worst === "major_outage" || worst === "partial_outage") return { state: worst, title: "Some services are experiencing issues", description: "Check the affected services and published updates below." };
  if (worst === "degraded") return { state: worst, title: "Some services are running slowly", description: "You may experience slower responses on the affected services." };
  if (worst === "maintenance") return { state: worst, title: "Scheduled maintenance is in progress", description: "Some services may be temporarily unavailable during this window." };
  if (worst === "unknown") return { state: worst, title: "Service health is not yet known", description: "No current checks are available." };
  const partial = snapshot.services.some(service => service.state === "unknown");
  return { state: worst, title: partial ? "Some checks are not yet available" : "All readiness checks are passing", description: partial ? "Check individual services below for the latest available results." : "The running MODE server passed every listed check. These checks verify service readiness, not every user workflow." };
}
