"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";

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
