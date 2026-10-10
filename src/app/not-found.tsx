"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function NotFound() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("mode-theme");
    if (stored === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("mode-dark");
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("mode-dark", next);
      window.localStorage.setItem("mode-theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <div className="not-found-page">
      {/* Top Brand Bar */}
      <header className="not-found-header">
        <Link href="/" className="brand" aria-label="Return to MODE Home">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          MODE<span className="brand-dot">·</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? "Use light theme" : "Use dark theme"}
            title={isDark ? "Use light theme" : "Use dark theme"}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <Link href="/" className="button primary" style={{ minHeight: "36px", padding: "8px 16px" }}>
            Workspace
          </Link>
        </div>
      </header>

      {/* Main 404 Canvas */}
      <main className="not-found-content">
        <div className="not-found-card">
          <div className="not-found-badge">
            <span className="tiny-dot" style={{ background: "#cc785c" }} />
            <span>404 · PAGE NOT FOUND</span>
          </div>

          <h1 className="not-found-title">
            This page stepped out of the <span>club agenda.</span>
          </h1>

          <p className="not-found-description">
            The page or resource you requested doesn't exist, has been rescheduled, or was moved to another section.
            Let's get you back on track with the club.
          </p>

          <div className="not-found-actions">
            <Link href="/" className="button primary" style={{ minWidth: "160px" }}>
              ← Return to workspace
            </Link>
          </div>

          {/* Quick Roster Links */}
          <div className="not-found-shortcuts">
            <span className="nav-caption" style={{ margin: "0 0 10px 0", display: "block" }}>
              OR JUMP STRAIGHT TO
            </span>
            <div className="not-found-shortcut-grid">
              <Link href="/" className="not-found-shortcut-item">
                <strong>Overview</strong>
                <span>Club balance & live updates</span>
              </Link>
              <Link href="/#members" className="not-found-shortcut-item">
                <strong>Members</strong>
                <span>Directory & active dues</span>
              </Link>
              <Link href="/#events" className="not-found-shortcut-item">
                <strong>Events</strong>
                <span>Calendar & upcoming meetups</span>
              </Link>
              <Link href="/#treasury" className="not-found-shortcut-item">
                <strong>Treasury</strong>
                <span>Inflow, expenses & ledger</span>
              </Link>
            </div>
          </div>

          <div className="sidebar-note" style={{ marginTop: "28px", textAlign: "left" }}>
            <span className="small-star">✳</span>
            <h3>Looking for your club records?</h3>
            <p>All active memberships, event registries, and finances are safely saved in your main workspace.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="workspace-footer" style={{ justifyContent: "center", padding: "20px 0" }}>
        <span>MODE Student Organization Workspace</span>
      </footer>
    </div>
  );
}
