"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LanguageSwitcher } from "@/i18n/client";
import { LandingTimeline } from "@/components/landing-timeline";

type LandingPageProps = {
  onSignIn: () => void;
};

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const capabilities = [
  ["MEMBERSHIP", "A member pass, dues status and club identity in one place."],
  ["EVENTS", "Tickets, guest access and door-ready records for each event."],
  ["TEAM WORK", "A practical task board for the people doing the work."],
  ["TREASURY", "Requests, approvals and a shared ledger without hidden spreadsheets."],
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  const capabilitiesRef = useRef<HTMLElement>(null);
  const closingRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      [capabilitiesRef.current, closingRef.current].forEach((panel) => {
        if (!panel) return;
        gsap.fromTo(panel, { xPercent: 100, autoAlpha: 0.65, backgroundColor: "#302b27" }, {
          xPercent: 0,
          autoAlpha: 1,
          backgroundColor: "#302b27",
          ease: "none",
          scrollTrigger: {
            trigger: panel,
            start: "top bottom",
            end: "top 12%",
            scrub: 0.7,
          },
        });
      });
    });
    return () => context.revert();
  }, []);

  return <main className="landing-page">
    <a className="skip-link" href="#landing-main">Skip to main content</a>
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="MODE home">
        <span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>
        MODE<span>.</span>
      </a>
      <nav className="landing-nav" aria-label="Landing navigation">
        <a href="#how-it-works">The rhythm</a>
        <a href="#built-for-clubs">What MODE holds</a>
      </nav>
      <div className="landing-actions">
        <LanguageSwitcher />
        <button className="landing-sign-in" type="button" onClick={onSignIn}>Sign in <span aria-hidden="true">→</span></button>
      </div>
    </header>

    <section className="landing-hero" id="top" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="landing-kicker"><span aria-hidden="true" /> A shared operating rhythm for clubs</p>
        <h1 id="landing-title">The club moves<br />when the work is <em>clear.</em></h1>
        <p className="landing-intro">MODE gives student teams one deliberate place for people, events, tasks and money—so each person knows what happens next.</p>
        <div className="landing-hero-actions">
          <button className="landing-primary" type="button" onClick={onSignIn}>Enter MODE <span aria-hidden="true">→</span></button>
          <a className="landing-secondary" href="#how-it-works">Explore the rhythm <span aria-hidden="true">↓</span></a>
        </div>
      </div>

      <div className="landing-hero-note" aria-label="How MODE supports a student club">
        <span>01</span>
        <p>For the people<br />doing the work.</p>
        <small>Not another dashboard—one shared source of truth.</small>
      </div>

      <div className="landing-register" aria-label="A sample MODE workspace preview">
        <div className="landing-register-top"><span>MODE / CLUB REGISTER</span><span className="landing-live"><i /> Live workspace</span></div>
        <div className="landing-register-heading"><div><p>THIS WEEK</p><strong>Make the work<br /><em>visible.</em></strong></div><span className="landing-date">OCT<br /><b>10</b></span></div>
        <div className="landing-register-grid">
          <section><p>UP NEXT</p><strong>Welcome social</strong><span>18:30 · Student commons</span></section>
          <section><p>TEAM TO-DOS</p><strong>08 <small>open</small></strong><div className="landing-progress"><i /><i /><i /><i /></div></section>
          <section className="landing-register-feature"><p>ONE THING TO DO</p><strong>Confirm volunteer desk</strong><span>Assigned to Aditi · Today</span><button type="button" onClick={onSignIn}>Review task <span aria-hidden="true">→</span></button></section>
        </div>
        <p className="landing-register-footer"><i /> The register updates as your team does.</p>
      </div>
      <p className="landing-caption">MEMBERS · EVENTS · TEAM WORK · TREASURY</p>
    </section>

    <LandingTimeline />

    <section className="landing-capabilities landing-scroll-panel" ref={capabilitiesRef} id="built-for-clubs" aria-labelledby="capabilities-title">
      <div><p className="landing-kicker"><span aria-hidden="true" /> Built around the work, not the paperwork</p><h2 id="capabilities-title">Every club has moving parts.<br /><em>MODE keeps them legible.</em></h2></div>
      <div className="landing-capability-list">{capabilities.map(([label, copy], index) => <article key={label}><span>0{index + 1}</span><div><p>{label}</p><h3>{copy}</h3></div><b aria-hidden="true">↗</b></article>)}</div>
    </section>

    <section className="landing-closing landing-scroll-panel" ref={closingRef} aria-labelledby="closing-title">
      <p>READY WHEN YOUR TEAM IS</p><h2 id="closing-title">Bring the club<br />into <em>focus.</em></h2><button className="landing-primary" type="button" onClick={onSignIn}>Go to sign in <span aria-hidden="true">→</span></button>
    </section>

    <footer className="landing-footer"><span className="landing-brand"><span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>MODE<span>.</span></span><p>Student organization workspace</p><button type="button" onClick={onSignIn}>Sign in</button></footer>
  </main>;
}
