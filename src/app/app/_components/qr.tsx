"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";

/** Public ticket page for a ticket token: a phone camera opens the ticket itself. */
export function ticketQrValue(token: string): string {
  return `${window.location.origin}/t/${encodeURIComponent(token)}`;
}

/** Door-scanner deep link for a member pass: an officer's phone opens the scanner with the pass prefilled. */
export function passQrValue(token: string): string {
  return `${window.location.origin}/app/door?credential=${encodeURIComponent(token)}`;
}

/** Accepts a raw token/short code or any of the QR URLs above and returns the credential the API expects. */
export function credentialFromScan(raw: string): string {
  const value = raw.trim();
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("credential");
    if (fromQuery) return fromQuery.trim();
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last);
  } catch {
    return value;
  }
}

/** Renders a QR code for a pass or ticket token. Falls back to the typed code when rendering fails. */
export function QrCode({ value, alt, size = 220 }: { value: string; alt: string; size?: number }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setFailed(false);
    toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#1a2a30", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [value, size]);
  if (failed) return <div className="mx-qr" style={{ width: size, height: size, display: "grid", placeItems: "center", textAlign: "center", fontSize: 12 }}>QR unavailable. Use the typed code.</div>;
  if (!src) return <div className="mx-qr mx-skel" style={{ width: size, height: size }} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="mx-qr" src={src} alt={alt} width={size} height={size} />;
}
