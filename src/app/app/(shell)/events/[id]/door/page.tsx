"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import jsQR from "jsqr";
import type { EventDetails, ScanOutcome, ScanResult } from "@/lib/contracts";
import { api, describeError, useLoad } from "../../../../_lib/api";
import { useSession } from "../../../../_lib/session";
import { dateTime, time } from "../../../../_lib/format";
import { Alert, Badge, Button, Card, EmptyState, ErrorState, LinkButton, PageHead, Skeleton } from "../../../../_components/ui";
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
    return <EmptyState title="Door volunteers only" action={<LinkButton href={`/app/events/${id}`}>Back to event</LinkButton>}>Scanning needs the tickets:check_in permission.</EmptyState>;
  }

  const e = event.data?.event;
  const tone: Tone | null = result ? TONE[result.outcome] : null;

  return (
    <>
      <p className="mx-small" style={{ marginBottom: 10 }}><Link href={`/app/events/${id}`} className="mx-link">← Back to event</Link></p>
      <PageHead
        eyebrow="Door scanner"
        title={e ? e.title : "Door scanner"}
        description={e ? `${dateTime(e.startsAt)} · ${e.venue}. Scan a ticket or member pass; admission needs a paid ticket for this event.` : undefined}
        actions={<Button variant={camera ? "default" : "accent"} onClick={() => setCamera((v) => !v)}><Icon.scan />{camera ? "Stop camera" : "Use camera"}</Button>}
      />
      {event.error ? <div className="mx-mb"><ErrorState error={event.error} onRetry={event.reload} /></div> : null}
      {cameraError ? <div className="mx-mb"><Alert tone="warning" onDismiss={() => setCameraError("")}>{cameraError}</Alert></div> : null}

      <div className="mx-grid mx-grid-main">
        <div className="mx-stack">
          <Card>
            <form className="mx-row" onSubmit={submit} style={{ flexWrap: "nowrap" }}>
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
                style={{ height: 52, fontSize: 20, fontFamily: "var(--mx-mono)", letterSpacing: 2 }}
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!credential.trim()} style={{ height: 52, padding: "0 22px" }}>Scan</Button>
            </form>
            {error ? <div className="mx-mt"><Alert tone="error" onDismiss={() => setError("")}>{error}</Alert></div> : null}
          </Card>

          {camera ? (
            <Card title="Camera" tone="tight">
              <video ref={videoRef} playsInline muted style={{ width: "100%", maxHeight: 360, borderRadius: 10, background: "#000", objectFit: "cover" }} />
              <p className="mx-muted mx-small" style={{ marginTop: 8 }}>Hold the QR steady inside the frame. Each code is checked once, then the camera pauses briefly.</p>
            </Card>
          ) : null}

          {result && tone ? (
            <div className={`mx-scan-result ${tone}`} role="status" aria-live="assertive">
              <p className="mx-eyebrow" style={{ color: "inherit", opacity: .85 }}>{result.admitted ? "Admit" : "Do not admit"}</p>
              <h2 className="mx-h1" style={{ marginTop: 6 }}>{result.message}</h2>
              {result.attendee ? <p style={{ fontSize: 20, marginTop: 10 }}>{result.attendee.name} <span style={{ opacity: .8 }}>· membership {result.attendee.membership}</span></p> : null}
              {result.outcome === "already_checked_in" && result.checkedInAt ? <p style={{ marginTop: 8, opacity: .9 }}>First checked in at {dateTime(result.checkedInAt)}</p> : null}
              <p style={{ marginTop: 12, opacity: .9 }}>{HINT[result.outcome]}</p>
            </div>
          ) : (
            <div className="mx-empty"><strong>Ready to scan</strong>Scan or type a code to see the door decision here.</div>
          )}
        </div>

        <div className="mx-stack">
          <Card title="This session" actions={log.length ? <Button size="sm" variant="ghost" onClick={() => setLog([])}>Clear</Button> : null}>
            {!log.length ? <p className="mx-muted mx-small">No scans yet.</p> : (
              <div className="mx-list">
                {log.map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className="mx-list-item" style={{ padding: "8px 0" }}>
                    <div className="mx-grow"><strong style={{ fontSize: 13 }}>{entry.name ?? <code className="mx-mono">{entry.credential}</code>}</strong><small>{time(entry.at)}{entry.name ? ` · ${entry.credential}` : ""}</small></div>
                    <Badge tone={TONE[entry.outcome] === "ok" ? "green" : TONE[entry.outcome] === "warn" ? "amber" : "red"} dot>{entry.outcome.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Door rules" tone="tight">
            {!e && event.loading ? <Skeleton rows={3} /> : (
              <ul className="mx-small mx-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Admit only on a green <strong>Admitted</strong> result.</li>
                <li>A member pass resolves to that member&apos;s ticket for this event.</li>
                <li>Pending payment goes to the desk, never through the door.</li>
                <li>Repeat scans never admit twice.</li>
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
