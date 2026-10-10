"use client";

import React from "react";
import { useI18n } from "@/i18n/client";

export function WorkspaceMainSkeleton() {
  const { t } = useI18n();
  return (
    <div className="skeleton-container" aria-busy="true" aria-label={t("skeleton.loading")}>
      <div className="skeleton-status-pill">
        <span className="skeleton-status-dot" aria-hidden="true" />
        <span>{t("skeleton.syncing")}</span>
      </div>

      {/* Metrics Row Skeleton */}
      <section className="metrics-grid" aria-label={t("skeleton.metrics")}>
        {/* Metric 1: Lavender */}
        <article className="metric-card skeleton-metric-card">
          <div className="metric-top">
            <span className="skeleton skeleton-text" style={{ width: "75px" }} />
            <span className="skeleton skeleton-icon" style={{ width: "30px", height: "30px", borderRadius: "10px" }} />
          </div>
          <div className="skeleton skeleton-title" style={{ width: "65px", height: "38px", marginTop: "12px" }} />
          <div className="skeleton skeleton-text" style={{ width: "120px", marginTop: "10px" }} />
        </article>

        {/* Metric 2: Peach */}
        <article className="metric-card skeleton-metric-card">
          <div className="metric-top">
            <span className="skeleton skeleton-text" style={{ width: "90px" }} />
            <span className="skeleton skeleton-icon" style={{ width: "30px", height: "30px", borderRadius: "10px" }} />
          </div>
          <div className="skeleton skeleton-title" style={{ width: "55px", height: "38px", marginTop: "12px" }} />
          <div className="skeleton skeleton-text" style={{ width: "140px", marginTop: "10px" }} />
        </article>

        {/* Metric 3: Mint */}
        <article className="metric-card skeleton-metric-card">
          <div className="metric-top">
            <span className="skeleton skeleton-text" style={{ width: "70px" }} />
            <span className="skeleton skeleton-icon" style={{ width: "30px", height: "30px", borderRadius: "10px" }} />
          </div>
          <div className="skeleton skeleton-title" style={{ width: "55px", height: "38px", marginTop: "12px" }} />
          <div className="skeleton skeleton-text" style={{ width: "110px", marginTop: "10px" }} />
        </article>

        {/* Metric 4: Dark (Club balance) */}
        <article className="metric-card metric-dark skeleton-metric-card">
          <div className="metric-top">
            <span className="skeleton skeleton-dark" style={{ width: "75px", height: "12px" }} />
            <span className="skeleton skeleton-dark" style={{ width: "30px", height: "30px", borderRadius: "10px" }} />
          </div>
          <div className="skeleton skeleton-dark" style={{ width: "110px", height: "38px", marginTop: "12px" }} />
          <div className="skeleton skeleton-dark" style={{ width: "140px", height: "10px", marginTop: "10px" }} />
        </article>
      </section>

      {/* Overview Grid Skeleton */}
      <div className="overview-grid">
        {/* Panel 1: Events */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="skeleton skeleton-text" style={{ width: "110px", height: "9px" }} />
              <div className="skeleton skeleton-title" style={{ width: "140px", height: "24px", marginTop: "8px" }} />
            </div>
            <span className="skeleton skeleton-pill" style={{ width: "65px", height: "20px" }} />
          </div>
          <div className="event-list">
            {[1, 2].map((idx) => (
              <article className="event-row" key={idx}>
                <div className="skeleton" style={{ width: "55px", height: "64px", borderRadius: "11px", flexShrink: 0 }} />
                <div className="event-info">
                  <div className="skeleton skeleton-title" style={{ width: "60%", height: "16px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "45%", height: "12px", marginTop: "8px" }} />
                  <div className="event-capacity" style={{ marginTop: "10px" }}>
                    <div className="skeleton" style={{ height: "4px", width: "90px", borderRadius: "3px" }} />
                    <div className="skeleton skeleton-text" style={{ width: "60px", height: "9px" }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="panel-footnote">
            <span className="tiny-dot" />
            <span className="skeleton skeleton-text" style={{ width: "180px", height: "10px" }} />
          </div>
        </section>

        {/* Panel 2: Tasks */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="skeleton skeleton-text" style={{ width: "100px", height: "9px" }} />
              <div className="skeleton skeleton-title" style={{ width: "135px", height: "24px", marginTop: "8px" }} />
            </div>
            <span className="skeleton skeleton-pill" style={{ width: "75px", height: "20px" }} />
          </div>
          <div className="task-list">
            {[1, 2, 3].map((idx) => (
              <article className="task-row" key={idx}>
                <div className="skeleton" style={{ width: "17px", height: "17px", borderRadius: "5px", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="skeleton skeleton-title" style={{ width: `${55 + idx * 10}%`, height: "14px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "90px", height: "10px", marginTop: "6px" }} />
                </div>
                <div className="skeleton skeleton-pill" style={{ width: "60px", height: "22px", borderRadius: "999px" }} />
              </article>
            ))}
          </div>
          <div className="panel-footnote">
            <span className="tiny-dot" />
            <span className="skeleton skeleton-text" style={{ width: "150px", height: "10px" }} />
          </div>
        </section>
      </div>

      {/* Overview Bottom Grid Skeleton */}
      <div className="overview-bottom" style={{ display: "grid", gridTemplateColumns: "1.07fr 1fr", gap: "23px", marginTop: "25px" }}>
        {/* Noticeboard Skeleton */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="skeleton skeleton-text" style={{ width: "90px", height: "9px" }} />
              <div className="skeleton skeleton-title" style={{ width: "120px", height: "24px", marginTop: "8px" }} />
            </div>
            <span className="skeleton skeleton-pill" style={{ width: "90px", height: "20px" }} />
          </div>
          <div style={{ padding: "0 25px 25px" }}>
            <div className="skeleton" style={{ width: "100%", height: "90px", borderRadius: "14px" }} />
          </div>
        </section>

        {/* Storefront / Merch Skeleton */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="skeleton skeleton-text" style={{ width: "90px", height: "9px" }} />
              <div className="skeleton skeleton-title" style={{ width: "130px", height: "24px", marginTop: "8px" }} />
            </div>
            <span className="skeleton skeleton-pill" style={{ width: "80px", height: "20px" }} />
          </div>
          <div style={{ padding: "0 25px 25px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ width: "100%", height: "45px", borderRadius: "10px" }} />
            <div className="skeleton" style={{ width: "100%", height: "45px", borderRadius: "10px" }} />
          </div>
        </section>
      </div>
    </div>
  );
}

export function WorkspaceShellSkeleton() {
  const { t } = useI18n();
  const navNames = [
    t("nav.overview"),
    t("nav.members"),
    t("nav.events"),
    t("nav.tasks"),
    t("nav.treasury"),
    t("skeleton.store"),
    t("skeleton.messages"),
  ];
  return (
    <div className="workspace">
      {/* Sidebar Skeleton */}
      <aside className="sidebar" aria-hidden="true">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          MODE<span className="brand-dot">·</span>
        </div>

        <div className="workspace-switch" style={{ border: "1px solid var(--line)" }}>
          <div className="skeleton" style={{ width: "33px", height: "35px", borderRadius: "10px", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-title" style={{ width: "80%", height: "14px" }} />
            <div className="skeleton skeleton-text" style={{ width: "50%", height: "10px", marginTop: "5px" }} />
          </div>
        </div>

        <div className="nav-caption">{t("skeleton.navigationKicker")}</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {navNames.map((name, i) => (
            <div
              key={name}
              className={`nav-item ${i === 0 ? "active" : ""}`}
              style={{ pointerEvents: "none" }}
            >
              <span className="skeleton" style={{ width: "16px", height: "16px", borderRadius: "4px" }} />
              <span style={{ flex: 1 }}>{name}</span>
              {i === 1 && <span className="skeleton skeleton-pill" style={{ width: "24px", height: "14px" }} />}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-star">✳</span>
            <h3>
              {t("nav.noteTitleLine1")}
              <br />
              {t("nav.noteTitleLine2")}
            </h3>
            <p>{t("nav.noteBody")}</p>
          </div>
        </div>
      </aside>

      {/* Workspace Body Skeleton */}
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{t("app.workspace")}</span>
            <span>/</span>
            <strong>{t("nav.overview")}</strong>
          </div>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="skeleton" style={{ width: "34px", height: "34px", borderRadius: "10px" }} />
            <div className="skeleton skeleton-pill" style={{ width: "120px", height: "24px" }} />
            <div className="skeleton" style={{ width: "34px", height: "34px", borderRadius: "50%" }} />
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="skeleton skeleton-text" style={{ width: "180px", height: "10px" }} />
              </div>
              <h1 style={{ marginTop: "10px" }}>
                {t("hero.titleLine1")} <span>{t("hero.titleLine2")}</span>
              </h1>
              <p>{t("skeleton.tagline")}</p>
            </div>
            <button className="button primary" type="button" disabled style={{ opacity: 0.7 }}>
              {t("members.addMember")}
            </button>
          </div>

          <WorkspaceMainSkeleton />
        </main>
      </div>
    </div>
  );
}
