"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SERVICE_CATALOG, STATUS_LABELS, activeIncidents, isFresh, snapshotSchema, statusOverview,
  type StatusIncident, type StatusSnapshot, type StatusState,
} from "../../lib/status";
import styles from "./status.module.css";

const marks: Record<StatusState, string> = { operational: "✓", degraded: "!", partial_outage: "!", major_outage: "×", maintenance: "↻", unknown: "−" };
const formatTime = (iso: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "UTC",
}).format(new Date(iso)) + " UTC";
const runningFor = (seconds: number) => seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
type RecentCheck = { at: string; state: StatusState };

function Badge({ state, label }: { state: StatusState; label?: string }) {
  return <span className={styles.badge} data-state={state}><span aria-hidden="true">{marks[state]}</span>{label ?? STATUS_LABELS[state]}</span>;
}

function Incident({ incident }: { incident: StatusIncident }) {
  return <article className={styles.incident} id={`incident-${incident.id}`}>
    <div className={styles.incidentTitle}><h3>{incident.title}</h3><Badge state={incident.updates.at(-1)!.stage === "resolved" ? "operational" : incident.impact} label={incident.updates.at(-1)!.stage === "resolved" ? "Resolved" : STATUS_LABELS[incident.impact]} /></div>
    <p className={styles.affected}>Affected: {incident.services.map(id => SERVICE_CATALOG.find(s => s.id === id)!.name).join(", ")}</p>
    <ol className={styles.timeline}>{[...incident.updates].reverse().map((update, index) => <li key={`${update.at}-${index}`}>
      <strong>{update.stage}</strong><p>{update.message}</p><time dateTime={update.at}>{formatTime(update.at)}</time>
    </li>)}</ol>
  </article>;
}

export function StatusDashboard() {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);
  const [origin, setOrigin] = useState("");
  const [recent, setRecent] = useState<RecentCheck[]>([]);
  const [roundTrip, setRoundTrip] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    const timeout = window.setTimeout(() => request.abort(), 10_000);
    const started = performance.now();
    try {
      const response = await fetch("/api/status", { cache: "no-store", credentials: "omit", signal: request.signal });
      if (!response.ok) throw new Error("Status unavailable");
      const next = snapshotSchema.parse(await response.json());
      if (!isFresh(next, Date.now())) throw new Error("Stale status");
      if (mounted.current && controller.current === request) {
        setSnapshot(next); setFailed(false); setNow(Date.now());
        setRoundTrip(Math.round(performance.now() - started));
        setRecent(previous => [...previous, { at: new Date().toISOString(), state: statusOverview(next, true).state }].slice(-30));
      }
    } catch {
      if (mounted.current && controller.current === request) {
        setFailed(true); setRoundTrip(null);
        setRecent(previous => [...previous, { at: new Date().toISOString(), state: "unknown" as const }].slice(-30));
      }
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) {
        controller.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());
    setOrigin(window.location.origin);
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10_000);
    const clock = window.setInterval(() => setNow(Date.now()), 5_000);
    const visible = () => { if (!document.hidden) { setNow(Date.now()); void refresh(); } };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      window.clearInterval(poll); window.clearInterval(clock);
      document.removeEventListener("visibilitychange", visible);
      const active = controller.current;
      controller.current = null;
      active?.abort();
    };
  }, [refresh]);

  const fresh = !failed && isFresh(snapshot, now);
  const initial = busy && !snapshot && !failed;
  const overview = statusOverview(snapshot, fresh);
  const active = snapshot ? activeIncidents(snapshot.notices, now) : [];
  const resolved = snapshot?.notices.incidents.filter(item => item.updates.at(-1)!.stage === "resolved")
    .sort((a, b) => Date.parse(b.updates.at(-1)!.at) - Date.parse(a.updates.at(-1)!.at)) ?? [];
  const maintenance = snapshot?.notices.maintenance.filter(item => Date.parse(item.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) ?? [];

  return <div className={styles.page} lang="en" dir="ltr">
    <a className={styles.skip} href="#status-main">Skip to service status</a>
    <header className={styles.header}>
      <a href="/" className={styles.brand} aria-label="MODE home">MO<span>DE</span><b aria-hidden="true">✦</b><i /> <small>Status</small></a>
      <a href="/" className={styles.back}>Back to MODE <span aria-hidden="true">↗</span></a>
    </header>
    <div className={styles.artwork}>
      <picture>
        <source media="(max-width: 600px)" srcSet="/status/spartan-banner-mobile.webp" width={1000} height={400} />
        <img
          src="/status/spartan-banner.webp"
          width={2172}
          height={400}
          alt="Friendly Spartan guardians maintaining pipes, checking instruments and tending MODE’s servers."
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
    <main id="status-main" className={styles.main} tabIndex={-1}>
      <div className={styles.intro}><p className={styles.eyebrow}><span /> OPEN TO EVERYONE</p><h1>A clear view of<br />how MODE is running.</h1><p>Service health and updates, all in one place.<br className={styles.mobileBreak} /> No account or sign-in needed.</p></div>
      <section className={styles.banner} data-state={initial ? "unknown" : overview.state} aria-live="polite" aria-atomic="true">
        <span className={styles.bannerIcon} aria-hidden="true">{initial ? "···" : marks[overview.state]}</span>
        <div><h2>{initial ? "Checking service health…" : overview.title}</h2><p>{initial ? "Getting the latest checks from MODE." : overview.description}</p></div>
      </section>
      <div className={styles.refreshRow}><p><span className={styles.liveDot} data-fresh={fresh} />{snapshot ? `${fresh ? "Last checked" : "Last successful update"}: ${formatTime(snapshot.checkedAt)}` : "Waiting for the first check"}</p><button type="button" disabled={busy} onClick={() => void refresh()}><span aria-hidden="true">↻</span> {busy ? "Refreshing…" : "Refresh"}</button></div>
      <section className={styles.runtime} aria-label="Live server measurements">
        <div><span>Connected server</span><strong>{origin || "Connecting…"}</strong></div>
        <div><span>Server process running for</span><strong>{fresh && snapshot?.serverUptimeSeconds !== undefined ? runningFor(snapshot.serverUptimeSeconds) : "Unavailable"}</strong></div>
        <div><span>Request round trip</span><strong>{fresh && roundTrip !== null ? `${roundTrip} ms` : "Unavailable"}</strong></div>
      </section>
      {recent.length > 0 && <section className={styles.recent} aria-label="Recent checks in this tab"><div className={styles.sectionHeading}><h2>Recent checks</h2><span>This tab · {recent.length} observed</span></div><div className={styles.samples}>{recent.map((check, index) => <span key={`${check.at}-${index}`} data-state={check.state} role="img" aria-label={`${formatTime(check.at)}: ${check.state === "unknown" ? "Server unreachable or invalid response" : STATUS_LABELS[check.state]}`} title={`${formatTime(check.at)}: ${check.state === "unknown" ? "Server unreachable or invalid response" : STATUS_LABELS[check.state]}`} />)}</div><p className={styles.note}>Actual requests since opening this tab. Gaps between requests are not measured; this is not an uptime percentage.</p></section>}
      <noscript><p className={styles.note}>Enable JavaScript to view live checks. The <a href="/api/status">public status API</a> is also available without signing in.</p></noscript>

      {active.length > 0 && <section className={styles.section} aria-labelledby="active-title"><div className={styles.sectionHeading}><h2 id="active-title">Active incidents</h2><span>{active.length} published</span></div>{!fresh && <p className={styles.note}>Previously retrieved updates. Current incident status could not be confirmed.</p>}{active.map(incident => <Incident key={incident.id} incident={incident} />)}</section>}

      <section className={styles.section} aria-labelledby="services-title">
        <div className={styles.sectionHeading}><h2 id="services-title">Services</h2><span>Checks refresh every 10 seconds</span></div>
        <div className={styles.services}>{SERVICE_CATALOG.map(service => {
          const observation = snapshot?.services.find(item => item.id === service.id);
          const state = fresh ? observation?.state ?? "unknown" : "unknown";
          const label = initial ? "Checking…" : !fresh ? "Status unavailable" : undefined;
          return <details key={service.id} className={styles.service}>
            <summary><span className={styles.serviceName}><span className={styles.chevron} aria-hidden="true">›</span>{service.name}</span><Badge state={state} label={label} /></summary>
            <div className={styles.serviceDetail}><p>{service.description}</p><p>{fresh ? observation?.detail : "The server could not be reached or the last check is stale. Start MODE and refresh to check again."}</p>{fresh && observation?.latencyMs !== null && observation?.latencyMs !== undefined && <span>Check duration: {observation.latencyMs} ms</span>}</div>
          </details>;
        })}</div>
        <div className={styles.legend}><Badge state="operational" /><Badge state="degraded" /><Badge state="major_outage" /><Badge state="unknown" /></div>
        <p className={styles.note}>These checks use the running server’s configured database and receipt storage. They do not create members, bookings, orders or login sessions, and do not verify complete user workflows.</p>
      </section>

      <section className={styles.section} aria-labelledby="maintenance-title"><div className={styles.sectionHeading}><h2 id="maintenance-title">Scheduled maintenance</h2><span>Planned work</span></div>
        {!fresh ? <div className={styles.empty}><span aria-hidden="true">−</span><div><h3>Maintenance schedule unavailable</h3><p>Refresh to check for planned work.</p></div></div> : maintenance.length ? maintenance.map(item => <article className={styles.incident} key={item.id}><h3>{item.title}</h3><p>{item.description}</p><p className={styles.affected}>{item.services.map(id => SERVICE_CATALOG.find(s => s.id === id)!.name).join(", ")}</p><p className={styles.affected}><time dateTime={item.startsAt}>{formatTime(item.startsAt)}</time> – <time dateTime={item.endsAt}>{formatTime(item.endsAt)}</time></p></article>) : <div className={styles.empty}><span aria-hidden="true">↻</span><div><h3>No maintenance published</h3><p>Planned service interruptions will be listed here.</p></div></div>}
      </section>

      <section className={styles.section} aria-labelledby="history-title"><div className={styles.sectionHeading}><h2 id="history-title">Incident history</h2><span>Published updates</span></div>
        {!fresh ? <div className={styles.empty}><span aria-hidden="true">−</span><div><h3>Incident history unavailable</h3><p>We cannot confirm published incidents right now.</p></div></div> : resolved.length ? resolved.map(incident => <Incident key={incident.id} incident={incident} />) : <div className={styles.empty}><span aria-hidden="true">≡</span><div><h3>No resolved incidents published</h3><p>Resolved incidents and their updates will appear here.</p></div></div>}
        <p className={styles.note}>Historical uptime is not yet collected. No published incidents does not mean 100% uptime.</p>
      </section>
      <aside className={styles.about}><span aria-hidden="true">i</span><p>This page reports checks from the MODE application. During a full application outage, the page may also be unavailable.</p></aside>
    </main>
    <footer className={styles.footer}><p><strong>MODE</strong> <span>Keeping your club connected.</span></p><nav aria-label="Status footer"><a href="/api/status">Status API ↗</a><a href="/">MODE home ↗</a></nav></footer>
  </div>;
}
