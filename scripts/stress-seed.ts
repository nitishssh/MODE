import { openClubDatabase } from '../src/lib/database';

const db = openClubDatabase(process.env.SQLITE_PATH!, { now: () => new Date('2026-10-11T06:00:00Z') });
const login = db.login({ email: 'lead@example.com', password: process.env.MODE_DEMO_PASSWORD! });
const actor = db.getActor(login.token)!;
const target = Number(process.env.STRESS_MEMBERS ?? 1000);
db.transaction(() => {
  const before = db.getMembers().length;
  for (let i = before; i < target; i++) db.createMember({ name: `Load Member ${i}`, email: `load-${i}@example.invalid` });
  if (process.env.STRESS_GROW_ONLY !== '1') {
    for (let i = db.events.listEvents(actor.clubId).length; i < 100; i++) {
      db.events.createEvent(actor, { title: `Load Event ${i}`, venue: 'Local test hall', startsAt: '2026-12-01T10:00:00Z', capacity: 500, memberPricePaise: 10000, guestPricePaise: 15000 });
    }
    for (let i = db.getTasks(actor, {}).length; i < 200; i++) db.createTask(actor, { title: `Load Task ${i}` });
  }
});
const dashboard = db.getDashboard(actor);
console.log(JSON.stringify({ members: dashboard.members.length, events: dashboard.events.length, tasks: dashboard.tasks.length, products: dashboard.products.length, transactions: dashboard.transactions.length }));
db.close();
