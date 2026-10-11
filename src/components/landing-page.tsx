"use client";

import { useEffect, useRef, useState } from "react";

type LandingPageProps = { onSignIn: () => void };

const navigation = [
  ["#workflow", "How it works"],
  ["#club-tools", "For your club"],
  ["#plans", "Club benefits"],
  ["/status", "Status"],
  ["#contact", "Open MODE"],
] as const;

const workflows = [
  ["01", "Membership", "A clear record of who is in the club, what they need, and where they belong."],
  ["02", "Events", "Plan the details, sell tickets, and welcome every guest with the same shared view."],
  ["03", "Team work", "Give every volunteer an owner, a next step, and a place to close the loop."],
  ["04", "Treasury", "Track requests, approvals, and balances without a separate spreadsheet."],
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobileOpen(false); menuButton.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMobileOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 641px)");
    const onResize = () => { if (desktop.matches) setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    desktop.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      desktop.removeEventListener("change", onResize);
    };
  }, [mobileOpen]);

  return (
    <div className="cm-page" id="top">
      <a className="cm-skip" href="#main-content">Skip to main content</a>
      <header className="cm-nav" ref={headerRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMobileOpen(false); }}>
        <a className="cm-logo" href="#top" aria-label="MODE home">MO<span>DE</span><b>✦</b></a>
        <nav className="cm-links" aria-label="Main navigation">
          {navigation.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="cm-nav-actions"><button className="cm-signin" type="button" onClick={onSignIn}>Sign in</button><button ref={menuButton} className="cm-menu" type="button" aria-controls="cm-mobile-navigation" aria-expanded={mobileOpen} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? "×" : "☰"}</button></div>
        <nav id="cm-mobile-navigation" className="cm-mobile-links" hidden={!mobileOpen} aria-label="Mobile navigation">{navigation.map(([href, label]) => <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>)}<button type="button" onClick={onSignIn}>Sign in to MODE →</button></nav>
      </header>

      <main id="main-content" tabIndex={-1}>
      <section className="cm-hero" aria-labelledby="cm-title">
        <div className="cm-hero-copy">
          <p className="cm-pill"><i />Built for student organizations</p>
          <h1 id="cm-title">The work behind a <span>great club</span> should feel lighter.</h1>
          <p className="cm-lede">MODE brings members, events, tasks and money into one calm workspace, so your team can spend less time chasing updates and more time making things happen.</p>
          <div className="cm-hero-actions"><button className="cm-primary" type="button" onClick={onSignIn}>Open your workspace <span>→</span></button><a className="cm-secondary" href="#workflow">See how MODE works <span>↓</span></a></div>
          <ul className="cm-assurances"><li>One shared source of truth</li><li>Made for student teams</li><li>Ready for the next event</li></ul>
        </div>
        <div className="cm-hero-art" aria-label="A MODE workspace preview">
          <div className="cm-window"><div className="cm-window-bar"><span><i /><i /><i /></span><b>mode.club / workspace</b><small>•••</small></div><div className="cm-window-body"><aside><strong>MO<span>DE</span></strong><em>OVERVIEW</em><a className="active">⌘&nbsp; This week</a><a>◌&nbsp; Members</a><a>□&nbsp; Events</a><a>✓&nbsp; Tasks</a><a>◒&nbsp; Treasury</a><small>YOUR CLUB</small><a>◉&nbsp; Arts Society</a></aside><section><div className="cm-preview-head"><div><p>ILLUSTRATIVE WORKSPACE</p><h2>Good morning, team.</h2></div><span>AS</span></div><div className="cm-preview-grid"><article className="cm-event"><p>UP NEXT <i>LIVE</i></p><h3>Autumn showcase</h3><span>Tonight · 6:30 PM</span><div><b>42</b><small>tickets checked in</small><button type="button" onClick={onSignIn}>Open event →</button></div></article><article className="cm-tasks"><p>TEAM TO-DOS <b>08 open</b></p><div className="cm-task done"><i>✓</i><span>Confirm welcome desk</span><small>Done</small></div><div className="cm-task"><i /><span>Print attendee list</span><small>Riya</small></div><div className="cm-task"><i /><span>Set up treasury float</span><small>Arjun</small></div><button type="button" onClick={onSignIn}>View all tasks <span>→</span></button></article></div><article className="cm-activity"><p>RECENT ACTIVITY</p><div><i>✓</i><span><b>Welcome desk confirmed</b><small>Aditi completed a task · just now</small></span><em>View board →</em></div></article></section></div></div>
          <div className="cm-alert"><span>✓</span><div><b>Task completed</b><small>Welcome desk is ready for tonight.</small></div></div><div className="cm-cursor" aria-hidden="true">⌁</div>
        </div>
      </section>

      <section className="cm-problem cm-reveal" aria-labelledby="cm-problem-title"><div><p className="cm-eyebrow">THE USUAL WAY</p><h2 id="cm-problem-title">The plan lives in five places.<br /><span>The details live in someone&apos;s head.</span></h2></div><div className="cm-problem-list"><p><i>01</i> Messages that disappear before the event</p><p><i>02</i> Lists that nobody knows are current</p><p><i>03</i> Money updates stuck in a private spreadsheet</p><p><i>04</i> Good volunteers waiting for their next step</p></div></section>
      <section className="cm-workflow cm-reveal" id="workflow" aria-labelledby="cm-workflow-title"><div className="cm-section-heading"><p className="cm-pill"><i />ONE PLACE, ONE RHYTHM</p><h2 id="cm-workflow-title">The club moves when<br /><span>everyone can see the next step.</span></h2><p>MODE turns everyday coordination into a simple, dependable rhythm for the whole team.</p></div><div className="cm-workflow-grid">{workflows.map(([number, title, copy]) => <article key={number}><span>{number}</span><div className="cm-workflow-icon">{number === "01" ? "◉" : number === "02" ? "□" : number === "03" ? "✓" : "◒"}</div><h3>{title}</h3><p>{copy}</p><a href="#club-tools">Explore <b>→</b></a></article>)}</div></section>
      <section className="cm-phone-section cm-reveal" id="club-tools" aria-labelledby="cm-phone-title"><div className="cm-phone-copy"><p className="cm-eyebrow">THE TEAM&apos;S POCKET COMPANION</p><h2 id="cm-phone-title">The answer your<br />team needs is <span>already here.</span></h2><p>Turn a quick check-in into a real update. MODE keeps conversations close to the work, so decisions and follow-ups do not get lost.</p><a className="cm-text-link" href="#plans">See the club workflow <b>→</b></a></div><div className="cm-phone-demo" role="img" aria-label="Illustrative MODE team conversation"><div className="cm-phone-notch" /><header><span>‹</span><i>AS</i><div><b>Arts Society</b><small>MODE club desk</small></div><em>⋮</em></header><div className="cm-phone-messages"><p className="cm-chat-date">TODAY</p><p className="cm-encryption">⌑ Club notes stay with your team.</p><div className="cm-bubble outgoing">Can someone confirm the welcome desk for tonight?<small>18:12 ✓✓</small></div><div className="cm-bubble incoming">Done. Aditi and Noor are on it. I&apos;ve marked the task complete.<small>18:13</small></div><div className="cm-bubble outgoing">Perfect, thank you!<small>18:13 ✓✓</small></div></div><footer><span>Write an update</span><b>➤</b></footer></div></section>
      <section className="cm-gains cm-reveal" id="plans" aria-labelledby="cm-gains-title"><div className="cm-gains-head"><p className="cm-eyebrow">YOUR CLUB, ONE MONTH IN</p><h2 id="cm-gains-title">More room for the<br /><span>things people remember.</span></h2></div><div className="cm-gains-panel"><article><b>01</b><h3>Events feel held</h3><p>Every ticket, task and guest detail has a home before the doors open.</p></article><article><b>02</b><h3>Teams stay aligned</h3><p>People see what they own and what changed, without another status meeting.</p></article><article><b>03</b><h3>Money stays clear</h3><p>Requests and balances are visible to the right people at the right time.</p></article></div></section>
      <section className="cm-cta cm-reveal" id="contact"><p className="cm-pill"><i />READY WHEN YOUR TEAM IS</p><h2>Bring your club<br />into <span>MODE.</span></h2><p>Start with the work you have this week. The rest gets easier from there.</p><button className="cm-primary" type="button" onClick={onSignIn}>Enter MODE <span>→</span></button></section></main><footer className="cm-footer"><a className="cm-logo" href="#top">MO<span>DE</span><b>✦</b></a><p>A shared operating rhythm for student organizations.</p><nav aria-label="Footer navigation">{navigation.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav><span>© {new Date().getFullYear()} MODE</span></footer>
    </div>
  );
}
