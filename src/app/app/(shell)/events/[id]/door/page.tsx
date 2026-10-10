"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import jsQR from "jsqr";
import type { EventDetails, ScanOutcome, ScanResult } from "@/lib/contracts";
import { api, describeError, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { dateTime, time } from "../../../../_lib/format";
import { Alert, Button, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
import { Icon } from "../../../../_components/icons";

type Tone = "ok" | "warn" | "bad";
const TONE: Record<ScanOutcome, Tone> = {
  admitted: "ok",
  already_checked_in: "warn",
  payment_pending: "warn",
  member_no_ticket: "warn",
  no_ticket_membership_expired: "warn",
  not_valid: "bad",
};
const HINT: Record<ScanOutcome, string> = {
  admitted: "Let them in.",
  already_checked_in: "This ticket was already used. Do not admit twice.",
  payment_pending: "Send them to the desk to confirm payment first.",
  member_no_ticket: "Active member, but no ticket for this event. They can book at the desk if seats remain.",
  no_ticket_membership_expired: "No ticket, and membership has lapsed. Guest price applies at the desk.",
  not_valid: "Unknown code, wrong event, or a cancelled/expired ticket.",
};
const BADGE: Record<Tone, string> = { ok: "green", warn: "amber", bad: "red" };

interface LogEntry { at: string; credential: string; outcome: ScanOutcome; name?: string }

function mask(value: string): string {
  return value.length <= 4 ? value : `…${value.slice(-4)}`;
}

export default function DoorPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const event = useLoad(() => api.get<{ event: EventDetails }>(`/api/events/${encodeURIComponent(id)}`), [id]);

  const [credential, setCredential] = useState("");
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
      const outcome = await api.post<ScanResult>(`/api/events/${encodeURIComponent(id)}/scan`, { credential: trimmed });
      setResult(outcome);
      setLog((current) => [{ at: new Date().toISOString(), credential: mask(trimmed), outcome: outcome.outcome, name: outcome.attendee?.name }, ...current].slice(0, 20));
      setCredential("");
    } catch (caught) {
      setError(describeError(caught, "The scan could not be checked. Try again."));
    } finally {
      submitting.current = false;
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [id]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void scan(credential);
  }

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Camera decoding loop.
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    setCameraError("");
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not available in this browser. Type the code instead.");
      setCamera(false);
      return;
    }
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
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        video.srcObject = stream;
        return video.play().then(() => { frameRef.current = requestAnimationFrame(tick); });
      })
      .catch(() => {
        if (!cancelled) { setCameraError("Could not start the camera. Check permissions, or type the code."); setCamera(false); }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [camera, scan]);

  if (!can("tickets:check_in")) {
    return (
      <section className="panel">
        <EmptyState title="Door volunteers only" icon="door" action={<LinkButton href={`/app/events/${id}`}>Back to event</LinkButton>}>Scanning needs the tickets:check_in permission.</EmptyState>
      </section>
    );
  }

  const e = event.data?.event;
  const tone: Tone | null = result ? TONE[result.outcome] : null;

  return (
    <>
      <PageHead
        eyebrow={<><Link href={`/app/events/${id}`}>EVENT</Link> <span>/</span> DOOR SCANNER</>}
        title={e ? e.title : "Door scanner"}
        description={e ? `${dateTime(e.startsAt)} · ${e.venue}. Scan a ticket or member pass; admission needs a paid ticket for this event.` : undefined}
        actions={<Button variant={camera ? "default" : "primary"} onClick={() => setCamera((v) => !v)}><Icon name="scan" size={18} />{camera ? "Stop camera" : "Use camera"}</Button>}
      />
      {event.error ? <ErrorState error={event.error} onRetry={event.reload} title="The event could not load" /> : null}
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
                placeholder="Type the 10-character code or paste a QR token"
                aria-label="Ticket or pass credential"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{ height: 52, fontSize: 18, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", letterSpacing: 2 }}
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!credential.trim()}>Scan</Button>
            </form>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </section>

          {camera ? (
            <Card kicker="CAMERA" title="Point at the QR">
              <video ref={videoRef} playsInline muted style={{ width: "100%", maxHeight: 360, borderRadius: 10, background: "#000", objectFit: "cover" }} />
              <p className="mx-muted mx-small" style={{ marginTop: 8 }}>Hold the QR steady inside the frame. Each code is checked once, then the camera pauses briefly.</p>
            </Card>
          ) : null}

          {result && tone ? (
            <div className={`mx-scan-result ${tone}`} role="status" aria-live="assertive">
              <div className="eyebrow" style={{ color: "inherit", opacity: .85 }}>{result.admitted ? "ADMIT" : "DO NOT ADMIT"}</div>
              <h2 style={{ marginTop: 6 }}>{result.message}</h2>
              {result.attendee ? <p style={{ fontSize: 18, marginTop: 10 }}>{result.attendee.name} <span style={{ opacity: .8 }}>· membership {result.attendee.membership}</span></p> : null}
              {result.outcome === "already_checked_in" && result.checkedInAt ? <p style={{ marginTop: 8, opacity: .9 }}>First checked in at {dateTime(result.checkedInAt)}</p> : null}
              <p style={{ marginTop: 12, opacity: .9 }}>{HINT[result.outcome]}</p>
            </div>
          ) : (
            <section className="panel">
              <EmptyState title="Ready to scan" icon="scan">Scan or type a code to see the door decision here.</EmptyState>
            </section>
          )}
        </div>

        <div className="mx-stack">
          <section className="panel">
            <div className="panel-heading">
              <div><div className="eyebrow">AT THE DOOR</div><h2>This session</h2></div>
              {log.length ? <button type="button" className="text-button" onClick={() => setLog([])}>Clear<Icon name="close" size={14} /></button> : null}
            </div>
            {!log.length ? <EmptyState title="No scans yet" icon="clock">The last 20 scans show here.</EmptyState> : (
              <div className="table-scroll">
                <table>
                  <thead><tr><th scope="col">Who</th><th scope="col">Time</th><th scope="col">Outcome</th></tr></thead>
                  <tbody>
                    {log.map((entry, i) => (
                      <tr key={`${entry.at}-${i}`}>
                        <td><strong>{entry.name ?? entry.credential}</strong>{entry.name ? <span className="subtext">{entry.credential}</span> : null}</td>
                        <td>{time(entry.at)}</td>
                        <td><span className={`badge ${BADGE[TONE[entry.outcome]]}`}>{entry.outcome.replace(/_/g, " ")}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <article className="notice-card">
            <span className="notice-icon"><Icon name="door" size={20} /></span>
            <div className="eyebrow">DOOR RULES</div>
            <h2>Admit on green only.</h2>
            {!e && event.loading ? <Skeleton rows={3} /> : (
              <p>
                A member pass resolves to that member&apos;s ticket for this event. Pending payment goes to the desk, never through the door. Repeat scans never admit twice.
              </p>
            )}
          </article>
        </div>
      </div>
    </>
  );
}
