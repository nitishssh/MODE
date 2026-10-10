import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../src/app/t/[token]/route';
import { getDatabase } from '../src/lib/database';
import { actorFor, DEMO, routeParams, withRouteDatabase } from './helpers';

// Value: protects=Guest HTML escapes stored text while API consumers still receive JSON; fails_when=Ticket text executes markup or browser rendering replaces JSON; why_new=Existing guest route tests only assert JSON; seam=none
test('guest ticket negotiates JSON and safe HTML including pending and admitted states', async () => {
  await withRouteDatabase(async () => {
    const db = getDatabase(); const organizer = actorFor(db, DEMO.organizer);
    const title = '<script>alert("event")</script>';
    const event = db.events.createEvent(organizer, { title, venue: '<img src=x onerror=alert(1)>', startsAt: '2026-11-01T13:30:00.000Z', capacity: 5, memberPricePaise: 100, guestPricePaise: 200 });
    const ticket = db.events.bookGuestTicket(organizer.clubId, event.id, { name: 'Guest <b>"&\'safe', email: 'safe@example.com' });
    const request = (accept: string) => GET(new Request(`http://localhost:3000/t/${ticket.qrToken}`, { headers: { Accept: accept } }), routeParams({ token: ticket.qrToken! }));
    for (const accept of ['application/json', '*/*']) {
      const response = await request(accept); assert.match(response.headers.get('content-type')!, /application\/json/);
      assert.equal((await response.json()).ticket.event.title, title);
    }
    const response = await request('text/html,application/xhtml+xml'); const html = await response.text();
    assert.match(response.headers.get('content-type')!, /text\/html/); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.match(response.headers.get('content-security-policy')!, /default-src 'none'/);
    assert.match(html, /&lt;script&gt;alert\(&quot;event&quot;\)&lt;\/script&gt;/); assert.match(html, /Guest &lt;b&gt;&quot;&amp;&#39;safe/);
    assert.doesNotMatch(html, /<script|<img/i); assert.match(html, /<svg/); assert.match(html, /Hold expires/); assert.match(html, /Pending tickets do not permit admission/);
    db.events.confirmTicket(organizer, ticket.id, { reference: 'GUEST-HTML' });
    db.events.scan(actorFor(db, DEMO.volunteer), event.id, { credential: ticket.shortCode });
    const admitted = await (await request('text/html')).text(); assert.match(admitted, /Admitted /); assert.doesNotMatch(admitted, /Hold expires/);
  });
});
