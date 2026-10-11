import { SERVICE_CATALOG, serviceState, type ServiceId, type StatusSnapshot } from "../../../lib/status";
import { getStatusNotices } from "../../../lib/status-notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Observation = StatusSnapshot["services"][number];
let cached: { expires: number; services: Observation[]; checkedAt: string } | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;

async function measure(id: ServiceId, check: () => unknown | Promise<unknown>): Promise<Observation> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Probe timeout")), 5000); }),
    ]);
    const latencyMs = Math.round(performance.now() - started);
    return { id, state: latencyMs >= 1000 ? "degraded" : "operational", latencyMs, detail: latencyMs >= 1000 ? "The readiness check passed but took longer than one second." : "The readiness check passed." };
  } catch {
    return { id, state: "major_outage", latencyMs: Math.round(performance.now() - started), detail: "The readiness check failed. Check the local server configuration and service availability." };
  } finally { if (timer) clearTimeout(timer); }
}

async function collect() {
  const services: Observation[] = [{ id: "api", state: "operational", latencyMs: null, detail: "The status API is responding." }];
  try {
    const { getDatabase } = await import("../../../lib/database");
    const db = getDatabase();
    services.push(await measure("database", () => db.health()));
    for (const id of ["auth", "events", "memberships", "merchandise", "receipts"] as const) {
      services.push(await measure(id, db.statusChecks[id]));
    }
  } catch {
    for (const service of SERVICE_CATALOG.filter(service => !services.some(result => result.id === service.id))) {
      services.push({ id: service.id, state: "major_outage", latencyMs: null, detail: "Application storage could not initialize, so this service is unavailable." });
    }
  }
  return { services, checkedAt: new Date().toISOString(), expires: Date.now() + 5000 };
}

/** Public and session-free. Share probes briefly to avoid repeated disk work per visitor. */
export async function GET(): Promise<Response> {
  if (!cached || cached.expires <= Date.now()) {
    pending ??= collect();
    try { cached = await pending; } finally { pending = undefined; }
  }
  const now = Date.now();
  const source = getStatusNotices();
  const notices = {
    ...source,
    incidents: source.incidents.map(incident => ({ ...incident, updates: incident.updates.filter(update => Date.parse(update.at) <= now) }))
      .filter(incident => incident.updates.length > 0),
  };
  const snapshot: StatusSnapshot = {
    checkedAt: cached.checkedAt, serverUptimeSeconds: Math.floor(process.uptime()), notices,
    services: cached.services.map(service => ({ ...service, state: serviceState(service.id, service.state, notices, now) })),
  };
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
