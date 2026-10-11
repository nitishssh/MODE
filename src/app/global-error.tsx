"use client";

import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("MODE root render failed", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <head><title>MODE temporarily unavailable</title></head>
      <body style={{ margin: 0, background: "#f4efe8", color: "#28231f", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" aria-labelledby="mode-global-error" style={{ width: "min(520px, 100%)", boxSizing: "border-box", padding: 32, border: "1px solid #d7cec4", borderRadius: 18, background: "#fffdf9", boxShadow: "0 12px 40px #28231f1a" }}>
            <p style={{ margin: "0 0 8px", color: "#a4513b", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>MODE</p>
            <h1 id="mode-global-error" style={{ margin: "0 0 12px", fontSize: 30 }}>The application couldn&apos;t start.</h1>
            <p style={{ margin: "0 0 22px", lineHeight: 1.6 }}>Your data has not been changed. Try loading MODE again.</p>
            <button type="button" onClick={retry} style={{ border: 0, borderRadius: 10, padding: "11px 18px", background: "#a4513b", color: "white", fontWeight: 700, cursor: "pointer" }}>Try again</button>
            {error.digest ? <p style={{ margin: "18px 0 0", color: "#746b64", fontSize: 12 }}>Reference: <code>{error.digest}</code></p> : null}
          </section>
        </main>
      </body>
    </html>
  );
}
