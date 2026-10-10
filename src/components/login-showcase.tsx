export function LoginShowcase() {
  return <section className="mode-login-showcase" aria-label="MODE club workspace overview">
    <img className="mode-login-art" src="/mode-login-scrapbook-left.png" alt="Illustrated MODE club register, event, membership pass, and expenses notebook" />
    <div className="mode-showcase-copy">
      <p className="mode-login-brand">MO<span>DE</span><b>✦</b></p>
      <h2>Your club,<br />in <em>good order.</em></h2>
      <p>Memberships, events, tasks and finances — together in one thoughtful workspace.</p>
    </div>
    <div className="mode-ledger-stage" aria-hidden="true">
      <i className="mode-paper-dot dot-one" /><i className="mode-paper-dot dot-two" /><i className="mode-paper-dot dot-three" />
      <article className="mode-ledger">
        <header><span>MODE / ARTS SOCIETY</span><b>CLUB REGISTER</b><em>OCT 10</em></header>
        <div className="mode-ledger-summary"><span><b>THIS WEEK</b><small>Autumn showcase</small></span><strong>06:30<span>PM</span></strong></div>
        <div className="mode-ledger-row"><i className="complete">✓</i><span>Confirm welcome desk</span><em>DONE</em></div>
        <div className="mode-ledger-row mode-ledger-row-highlight"><i>•</i><span>Prepare ticket list</span><em>NOW</em></div>
        <div className="mode-ledger-row"><i>○</i><span>Post expense receipt</span><em>OPEN</em></div>
        <footer><span>MEMBERS <b>48</b></span><span>DUES <b>₹12,400</b></span><span>EVENT <b>24 tickets</b></span></footer>
      </article>
      <article className="mode-event-ticket"><small>MODE EVENT TICKET</small><b>AUTUMN<br />SHOWCASE</b><span>18:30 · OCT 10</span><i>AS</i></article>
      <article className="mode-ledger-note"><i>✓</i><span><b>Task confirmed</b><small>Welcome desk is ready</small></span></article>
    </div>
    <p className="mode-showcase-footer">MADE FOR THE WORK BEHIND EVERY GREAT CLUB</p>
  </section>;
}
