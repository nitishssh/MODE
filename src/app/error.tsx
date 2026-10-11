"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("MODE page render failed", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <main className="not-found-content">
      <section className="not-found-card" role="alert" aria-labelledby="mode-error-title">
        <div className="not-found-badge"><span className="tiny-dot" /><span>Temporary problem</span></div>
        <h1 id="mode-error-title" className="not-found-title">We couldn&apos;t open this page.</h1>
        <p className="not-found-description">Your saved records are unchanged. Retry the page, or return to the workspace if the problem continues.</p>
        <div className="not-found-actions">
          <button type="button" className="button primary" onClick={retry}>Try again</button>
          <a className="button secondary" href="/app">Open workspace</a>
        </div>
        {error.digest ? <p className="mx-muted mx-small">Reference: <code>{error.digest}</code></p> : null}
      </section>
    </main>
  );
}
