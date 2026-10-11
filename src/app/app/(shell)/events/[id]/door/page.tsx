"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import jsQR from "jsqr";
import type { EventDetails, ScanOutcome, ScanResult } from "@/lib/contracts";
import { api, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { useT } from "../../../../_lib/i18n";
import { Alert, Button, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
import { Icon } from "../../../../_components/icons";
import { credentialFromScan } from "../../../../_components/qr";

type Tone = "ok" | "warn" | "bad";
const TONE: Record<ScanOutcome, Tone> = {
  admitted: "ok",
  already_checked_in: "warn",
  payment_pending: "warn",
  member_no_ticket: "warn",
  no_ticket_membership_expired: "warn",
  not_valid: "bad",
};
const BADGE: Record<Tone, string> = { ok: "green", warn: "amber", bad: "red" };
const MEMBERSHIP_KEY = { active: "status.active", expired: "status.expired", none: "status.none", guest: "status.guest" } as const;

interface LogEntry { at: string; credential: string; outcome: ScanOutcome; name?: string }

function mask(value: string): string {
  return value.length <= 4 ? value : `…${value.slice(-4)}`;
}

export default function DoorPage() {
  return <Suspense fallback={<Skeleton rows={4} />}><DoorScanner /></Suspense>;
}

function DoorScanner() {
  const { t, fmt, apiError } = useT();
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id]);

  // A member-pass QR encodes /app/door?credential=…; once the officer picks the event we arrive here with it.
  const fromUrl = useSearchParams().get("credential") ?? "";
  const [credential, setCredential] = useState(fromUrl);
  const prefilled = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const pausedUntil = useRef(0);
  const submitting = useRef(false);

  const scan = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const outcome = await api.post<ScanResult>(`/api/events/${encodeURIComponent(id)}/scan`, { credential: credentialFromScan(trimmed) });
      setResult(outcome);
      setLog((current) => [{ at: new Date().toISOString(), credential: mask(trimmed), outcome: outcome.outcome, name: outcome.attendee?.name }, ...current].slice(0, 20));
      setCredential("");
    } catch (caught) {
      setError(apiError(caught, "events.door.scanFailed"));
    } finally {
      submitting.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [id, apiError]);

  useEffect(() => {
    if (prefilled.current || !fromUrl) return;
    prefilled.current = true;
    void scan(fromUrl);
  }, [fromUrl, scan]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void scan(credential);
  }

  useEffect(() => { inputRef.current?.focus(); }, []);

  function toggleCamera() {
    if (camera) { setCamera(false); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t("events.door.cameraUnavailable"));
      return;
    }
    setCameraError("");
    setCamera(true);
  }

  // Camera decoding loop. Availability is checked in toggleCamera before this starts.
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (cancelled) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && context && Date.now() >= pausedUntil.current && !submitting.current) {
        const width = video.videoWidth, height = video.videoHeight;
        if (width && height) {
          canvas.width = width;
          canvas.height = height;
          context.drawImage(video, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const code = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            pausedUntil.current = Date.now() + 2500;
            void scan(code.data);
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        video.srcObject = stream;
        return video.play().then(() => { frameRef.current = requestAnimationFrame(tick); });
      })
      .catch(() => {
        if (!cancelled) { setCameraError(t("events.door.cameraFailed")); setCamera(false); }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [camera, scan, t]);

  if (!can("tickets:check_in")) {
    return (
      <section className="panel">
        <EmptyState title={t("events.door.volunteersOnly")} icon="door" action={<LinkButton href={`/app/events/${id}`}>{t("events.edit.backToEvent")}</LinkButton>}>{t("events.door.needsPermission")}</EmptyState>
      </section>
    );
  }

  const e = event.data?.event;
  const tone: Tone | null = result ? TONE[result.outcome] : null;

  return (
    <>
      <PageHead
        eyebrow={<><Link href={`/app/events/${id}`}>{t("events.door.eventEyebrow")}</Link> <span>/</span> {t("events.door.eyebrow")}</>}
        title={e ? e.title : t("events.door.title")}
        description={e ? t("events.door.description", { when: fmt.dateTime(e.startsAt), venue: e.venue }) : undefined}
        actions={<Button variant={camera ? "default" : "primary"} onClick={toggleCamera}><Icon name="scan" size={18} />{camera ? t("events.door.stopCamera") : t("events.door.useCamera")}</Button>}
      />
      {event.error ? <ErrorState error={event.error} onRetry={event.reload} title={t("events.door.eventLoadFailed")} /> : null}
      {cameraError ? <Alert tone="warning" onDismiss={() => setCameraError("")}>{cameraError}</Alert> : null}

      <div className="overview-grid">
        <div className="mx-stack">
          <section className="panel task-create-panel" style={{ marginBottom: 0 }}>
            <form onSubmit={submit} className="mx-row" style={{ flexWrap: "nowrap" }}>
              <input
                className="mx-input"
                ref={inputRef}
                value={credential}
                onChange={(ev) => setCredential(ev.target.value)}
                placeholder={t("events.door.placeholder")}
                aria-label={t("events.door.inputLabel")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{ height: 52, fontSize: 18, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", letterSpacing: 2 }}
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!credential.trim()}>{t("events.door.scan")}</Button>
            </form>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </section>

          {camera ? (
            <Card kicker={t("events.door.cameraKicker")} title={t("events.door.cameraTitle")}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", maxHeight: 360, borderRadius: 10, background: "#000", objectFit: "cover" }} />
              <p className="mx-muted mx-small" style={{ marginTop: 8 }}>{t("events.door.cameraHint")}</p>
            </Card>
          ) : null}

          {result && tone ? (
            <div className={`mx-scan-result ${tone}`} role="status" aria-live="assertive">
              <div className="eyebrow" style={{ color: "inherit", opacity: .85 }}>{result.admitted ? t("events.door.admit") : t("events.door.doNotAdmit")}</div>
              <h2 style={{ marginTop: 6 }}>{t(`events.door.outcome.${result.outcome}`)}</h2>
              {result.attendee ? <p style={{ fontSize: 18, marginTop: 10 }}>{result.attendee.name} <span style={{ opacity: .8 }}>{t("events.door.attendeeMembership", { state: t(MEMBERSHIP_KEY[result.attendee.membership]) })}</span></p> : null}
              {result.outcome === "already_checked_in" && result.checkedInAt ? <p style={{ marginTop: 8, opacity: .9 }}>{t("events.door.firstCheckedIn", { time: fmt.dateTime(result.checkedInAt) })}</p> : null}
              <p style={{ marginTop: 12, opacity: .9 }}>{t(`events.door.hint.${result.outcome}`)}</p>
            </div>
          ) : (
            <section className="panel">
              <EmptyState title={t("events.door.readyTitle")} icon="scan">{t("events.door.readyBody")}</EmptyState>
            </section>
          )}
        </div>

        <div className="mx-stack">
          <section className="panel">
            <div className="panel-heading">
              <div><div className="eyebrow">{t("events.door.sessionKicker")}</div><h2>{t("events.door.sessionTitle")}</h2></div>
              {log.length ? <button type="button" className="text-button" onClick={() => setLog([])}>{t("events.door.clear")}<Icon name="close" size={14} /></button> : null}
            </div>
            {!log.length ? <EmptyState title={t("events.door.noScans")} icon="clock">{t("events.door.noScansBody")}</EmptyState> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">{t("events.door.colWho")}</th><th scope="col">{t("events.door.colTime")}</th><th scope="col">{t("events.door.colOutcome")}</th></tr></thead>
                  <tbody>
                    {log.map((entry, i) => (
                      <tr key={`${entry.at}-${i}`}>
                        <td><strong>{entry.name ?? entry.credential}</strong>{entry.name ? <span className="subtext">{entry.credential}</span> : null}</td>
                        <td>{fmt.dateTime(entry.at)}</td>
                        <td><span className={`badge ${BADGE[TONE[entry.outcome]]}`}>{t(`events.door.outcome.${entry.outcome}`)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <article className="notice-card">
            <span className="notice-icon"><Icon name="door" size={20} /></span>
            <div className="eyebrow">{t("events.door.rulesKicker")}</div>
            <h2>{t("events.door.rulesTitle")}</h2>
            {!e && event.loading ? <Skeleton rows={3} /> : <p>{t("events.door.rulesBody")}</p>}
          </article>
        </div>
      </div>
    </>
  );
}
