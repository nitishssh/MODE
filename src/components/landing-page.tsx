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

  return <main className="landing-page" id="landing-main">
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

      <div className="landing-register" aria-label="A sample MODE workspace preview" tabIndex={0}>
        <div className="landing-register-top"><span>MODE / CLUB REGISTER</span><span className="landing-live"><i /> Live workspace</span></div>
        <div className="landing-register-heading"><div><p>THIS WEEK</p><strong>Make the work<br /><em>visible.</em></strong></div><span className="landing-date">OCT<br /><b>10</b></span></div>
        <div className="landing-register-grid">
          <section><p>UP NEXT</p><strong>Welcome social</strong><span>18:30 · Student commons</span></section>
          <section><p>TEAM TO-DOS</p><strong>08 <small>open</small></strong><div className="landing-progress"><i /><i /><i /><i /></div></section>
          <section className="landing-register-feature"><p>ONE THING TO DO</p><strong>Confirm volunteer desk</strong><span>Assigned to Aditi · Today</span><button type="button" onClick={onSignIn}>Review task <span aria-hidden="true">→</span></button></section>
        </div>
        <p className="landing-register-footer"><i /> The register updates as your team does.</p>
        <span className="landing-register-popover" aria-hidden="true"><i>✓</i><span><b>Volunteer desk confirmed</b><small>Task moved to done · just now</small></span></span>
      </div>
      <p className="landing-caption">MEMBERS · EVENTS · TEAM WORK · TREASURY</p>
    </section>

    <LandingTimeline />

    <section className="landing-capabilities landing-scroll-panel" ref={capabilitiesRef} id="built-for-clubs" aria-labelledby="capabilities-title">
      <div><p className="landing-kicker"><span aria-hidden="true" /> Built around the work, not the paperwork</p><h2 id="capabilities-title">Every club has moving parts.<br /><em>MODE keeps them legible.</em></h2></div>
      <div className="landing-capability-list">{capabilities.map(([label, copy], index) => <article key={label}><span>0{index + 1}</span><div><p>{label}</p><h3>{copy}</h3></div><b aria-hidden="true">↗</b></article>)}
        <a className="landing-whatsapp-section" href="https://wa.me/?text=Hi%20MODE%2C%20I%20would%20like%20to%20know%20more%20about%20the%20club%20workspace." target="_blank" rel="noreferrer">
          <span className="landing-whatsapp-section-copy"><i>◔</i><span><b>Need a hand?</b><small>Talk to the MODE team on WhatsApp.</small></span></span><strong>Chat <em>↗</em></strong>
          <span className="landing-whatsapp-section-pop" aria-hidden="true"><i>MODE</i><span>Hi! What are you planning next?</span></span>
        </a>
      </div>
    </section>

    <section className="landing-closing landing-scroll-panel" ref={closingRef} aria-labelledby="closing-title">
      <p>READY WHEN YOUR TEAM IS</p><h2 id="closing-title">Bring the club<br />into <em>focus.</em></h2><button className="landing-primary" type="button" onClick={onSignIn}>Go to sign in <span aria-hidden="true">→</span></button>
    </section>

    <footer className="landing-footer"><span className="landing-brand"><span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>MODE<span>.</span></span><p>Student organization workspace</p><button type="button" onClick={onSignIn}>Sign in</button></footer>

    <a
      className="landing-whatsapp"
      href="https://wa.me/?text=Hi%20MODE%2C%20I%20would%20like%20to%20know%20more%20about%20the%20club%20workspace."
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with MODE on WhatsApp"
    >
      <span className="landing-whatsapp-card" aria-hidden="true">
        <span className="landing-whatsapp-card-top"><i>MODE</i><b>Typically replies soon</b></span>
        <span className="landing-whatsapp-message">Hey! Need a hand getting your club into MODE? <em>We&apos;re here.</em></span>
        <span className="landing-whatsapp-cta">Start a chat <b>↗</b></span>
      </span>
      <span className="landing-whatsapp-orb" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false"><path d="M16 3.2a12.5 12.5 0 0 0-10.7 19L3.7 28.8l6.8-1.8A12.5 12.5 0 1 0 16 3.2Zm0 22.8c-1.75 0-3.47-.47-4.98-1.35l-.36-.2-4.04 1.06 1.08-3.93-.24-.4A10.1 10.1 0 1 1 16 26Zm5.54-7.55c-.3-.16-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.63.07-.3-.15-1.24-.46-2.36-1.46a8.84 8.84 0 0 1-1.63-2.02c-.17-.3-.02-.45.13-.6.14-.14.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.48 1.69.61.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" /></svg>
      </span>
      <span className="landing-whatsapp-hint" aria-hidden="true">Ask us anything</span>
    </a>
  </main>;
}
