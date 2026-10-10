"use client";

import { LanguageSwitcher } from "@/i18n/client";

type LandingPageProps = {
  onSignIn: () => void;
};

const milestones = [
  { number: "01", title: "Plan together", copy: "Keep events, people and responsibilities in one shared register." },
  { number: "02", title: "Move work forward", copy: "Turn volunteer work into clear, visible tasks with an honest next step." },
  { number: "03", title: "Close the loop", copy: "Record approvals and balances so the team can see what happened." },
];

const capabilities = [
  ["MEMBERSHIP", "A member pass, dues status and club identity in one place."],
  ["EVENTS", "Tickets, guest access and door-ready records for each event."],
  ["TEAM WORK", "A practical task board for the people doing the work."],
  ["TREASURY", "Requests, approvals and a shared ledger without hidden spreadsheets."],
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  return <main className="landing-page">
    <a className="skip-link" href="#landing-main">Skip to main content</a>
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="MODE home">
        <span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>
        MODE<span>.</span>
      </a>
      <nav className="landing-nav" aria-label="Landing navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#built-for-clubs">Built for clubs</a>
      </nav>
      <div className="landing-actions">
        <LanguageSwitcher />
        <button className="landing-sign-in" type="button" onClick={onSignIn}>Sign in <span aria-hidden="true">→</span></button>
      </div>
    </header>

    <section className="landing-hero" id="top" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="landing-kicker"><span aria-hidden="true" /> Student organizations, in sync</p>
        <h1 id="landing-title">The quiet system behind a <em>well-run</em> club.</h1>
        <p className="landing-intro">MODE gives student teams one calm place to coordinate members, events, tasks and money—without losing the human side of club work.</p>
        <div className="landing-hero-actions">
          <button className="landing-primary" type="button" onClick={onSignIn}>Open your workspace <span aria-hidden="true">→</span></button>
          <a className="landing-secondary" href="#how-it-works">See the flow <span aria-hidden="true">↓</span></a>
        </div>
        <p className="landing-caption">Built for real student teams · Clear by design · No guesswork</p>
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
    </section>

    <section className="landing-timeline" id="how-it-works" aria-labelledby="flow-title">
      <div className="landing-section-heading"><p>ONE SHARED RHYTHM</p><h2 id="flow-title">Small steps make the <em>whole club</em> move.</h2><span>Scroll the story</span></div>
      <div className="landing-timeline-track" role="list">
        {milestones.map((item) => <article className="landing-timeline-item" key={item.number} role="listitem"><span className="landing-timeline-stem" aria-hidden="true"><i /></span><p>{item.number}</p><h3>{item.title}</h3><span>{item.copy}</span></article>)}
      </div>
    </section>

    <section className="landing-capabilities" id="built-for-clubs" aria-labelledby="capabilities-title">
      <div><p className="landing-kicker"><span aria-hidden="true" /> Built around the work, not the paperwork</p><h2 id="capabilities-title">Every club has moving parts.<br /><em>MODE keeps them legible.</em></h2></div>
      <div className="landing-capability-list">{capabilities.map(([label, copy], index) => <article key={label}><span>0{index + 1}</span><div><p>{label}</p><h3>{copy}</h3></div><b aria-hidden="true">↗</b></article>)}</div>
    </section>

    <section className="landing-closing" aria-labelledby="closing-title">
      <p>READY WHEN YOUR TEAM IS</p><h2 id="closing-title">Bring the club<br />into <em>focus.</em></h2><button className="landing-primary" type="button" onClick={onSignIn}>Go to sign in <span aria-hidden="true">→</span></button>
    </section>

    <footer className="landing-footer"><span className="landing-brand"><span className="landing-mark" aria-hidden="true"><i /><i /><i /></span>MODE<span>.</span></span><p>Student organization workspace</p><button type="button" onClick={onSignIn}>Sign in</button></footer>
  </main>;
}
