#!/usr/bin/env node
/**
 * Fill a running MODE server with a rich, consistent demo dataset by driving
 * the real API as the right role for each action, so every ticket, order,
 * dues payment and reimbursement goes through the same invariants, holds and
 * ledger posting as a real club would.
 *
 *   node scripts/demo-data.mjs [--base http://127.0.0.1:3000] [--password mode-demo-2026]
 *     [--club-name "Spectrum Collective"] [--sqlite .data/mode.sqlite]
 *
 * --club-name renames the club directly in the SQLite file (there is no rename API);
 * run it on the machine that hosts the database.
 *
 * Idempotent enough to re-run: members that already exist are signed in
 * instead of re-registered; events and products are matched by name.
 * Everything it creates uses the password above so you can sign in as anyone.
 */
import QRCode from "qrcode";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"] : [])).filter(Boolean));
const BASE = (args.base ?? process.env.MODE_BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const PASSWORD = args.password ?? process.env.MODE_DEMO_PASSWORD ?? "mode-demo-2026";

// ── tiny client ─────────────────────────────────────────────────────────────
class HttpError extends Error { constructor(status, body) { super(`${status} ${typeof body === "string" ? body : JSON.stringify(body)}`); this.status = status; this.body = body; } }
async function call(method, path, { token, body, form } = {}) {
  const headers = { Origin: BASE };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new HttpError(res.status, data);
  return data;
}
const get = (p, token) => call("GET", p, { token });
const post = (p, body, token) => call("POST", p, { token, body });
const patch = (p, body, token) => call("PATCH", p, { token, body });

const counts = {};
const bump = (k, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };
const log = (msg) => process.stdout.write(`${msg}\n`);

// deterministic pseudo-random so re-runs look the same
let seed = 20261011;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const sample = (arr, n) => { const copy = [...arr]; const out = []; while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]); return out; };
const ref = (prefix) => `${prefix}-${Math.floor(rand() * 9e5 + 1e5)}`;
const daysFromNow = (d, hour = 17, minute = 30) => { const t = new Date(); t.setUTCDate(t.getUTCDate() + d); t.setUTCHours(hour - 5, minute - 30, 0, 0); return t.toISOString(); }; // IST wall clock

async function login(email) {
  const r = await post("/api/auth/login", { email, password: PASSWORD });
  return { token: r.token, user: r.user };
}
async function loginOrRegister(name, email) {
  try { return await login(email); } catch (e) {
    if (e.status !== 401) throw e;
    const r = await post("/api/auth/register", { name, email, password: PASSWORD });
    bump("members registered");
    return { token: r.token, user: r.user };
  }
}

// ── data ────────────────────────────────────────────────────────────────────
const PEOPLE = [
  ["Aarav Mehta", "aarav.mehta"], ["Ananya Iyer", "ananya.iyer"], ["Rohan Kulkarni", "rohan.kulkarni"], ["Priya Nair", "priya.nair"],
  ["Kabir Singh", "kabir.singh"], ["Ishita Sharma", "ishita.sharma"], ["Vihaan Reddy", "vihaan.reddy"], ["Diya Banerjee", "diya.banerjee"],
  ["Arjun Desai", "arjun.desai"], ["Sneha Pillai", "sneha.pillai"], ["Aditya Rao", "aditya.rao"], ["Meher Kaur", "meher.kaur"],
  ["Nikhil Joshi", "nikhil.joshi"], ["Tanvi Shetty", "tanvi.shetty"], ["Yash Patel", "yash.patel"], ["Riya Chatterjee", "riya.chatterjee"],
  ["Siddharth Menon", "siddharth.menon"], ["Pooja Hegde", "pooja.hegde"], ["Dev Malhotra", "dev.malhotra"], ["Kavya Krishnan", "kavya.krishnan"],
  ["Harsh Vora", "harsh.vora"], ["Nandini Gowda", "nandini.gowda"], ["Rahul Bhat", "rahul.bhat"], ["Shreya Das", "shreya.das"],
  ["Manav Agarwal", "manav.agarwal"], ["Aisha Khan", "aisha.khan"], ["Varun Nambiar", "varun.nambiar"], ["Lakshmi Suresh", "lakshmi.suresh"],
  ["Om Prakash", "om.prakash"], ["Zara Sheikh", "zara.sheikh"],
];

const EVENTS = [
  { title: "Freshers' Welcome Night", venue: "NMIT Open Air Theatre", days: 3, capacity: 180, member: 0, guest: 5000, description: "Ice-breakers, club introductions and a live set by the campus band. Free for members, ₹50 for guests." },
  { title: "Hack the Campus 2026", venue: "Innovation Lab, Block C", days: 6, capacity: 120, member: 15000, guest: 30000, description: "24-hour hackathon with mentors from three startups. Teams of up to four. Meals and swag included." },
  { title: "Diwali Mela", venue: "Central Quadrangle", days: 9, capacity: 400, member: 5000, guest: 10000, description: "Food stalls, rangoli contest, diya painting and the evening lamp ceremony. Bring family." },
  { title: "Inter-College Debate Finals", venue: "Seminar Hall 2", days: 12, capacity: 150, member: 0, guest: 10000, description: "Four colleges, one motion. Judges from the Bangalore Debating Society." },
  { title: "Photography Walk: Old Bengaluru", venue: "Meet at Main Gate", days: 15, capacity: 40, member: 20000, guest: 35000, description: "Guided heritage walk through Basavanagudi with a working photojournalist. Any camera welcome." },
  { title: "Entrepreneurship Talk: Zero to Seed", venue: "Auditorium A", days: 18, capacity: 250, member: 0, guest: 15000, description: "Two founders on raising a first cheque in 2026. Q&A and networking tea afterwards." },
  { title: "Movie Night: Classic Kannada Cinema", venue: "Library Lawn", days: 22, capacity: 200, member: 5000, guest: 8000, description: "Open-air screening with subtitles, popcorn and blankets. Starts at sunset." },
  { title: "Blood Donation Camp", venue: "Health Centre", days: 26, capacity: 300, member: 0, guest: 0, description: "In partnership with Rotary Bangalore. Register to reserve a slot; walk-ins welcome if space allows." },
  { title: "Winter Coding Bootcamp", venue: "Computer Lab 4", days: 33, capacity: 60, member: 50000, guest: 90000, description: "Five evenings on TypeScript, SQLite and shipping a real app. Laptops required." },
  { title: "Annual Cultural Fest: Rhythm 2026", venue: "Main Grounds", days: 41, capacity: 1200, member: 10000, guest: 25000, description: "Three days of music, dance and drama. Early-bird pricing until the end of the month." },
  { title: "Alumni Mixer", venue: "Faculty Club", days: 48, capacity: 90, member: 25000, guest: 40000, description: "Meet alumni from the 2016 to 2024 batches over dinner. Smart casual." },
  { title: "Robotics Showcase", venue: "Mechanical Workshop", days: 55, capacity: 100, member: 0, guest: 5000, description: "Student-built bots, line followers and a sumo ring. Prizes for the crowd favourite." },
  { title: "Orientation Week Recap", venue: "Seminar Hall 1", days: -12, capacity: 120, member: 0, guest: 0, description: "Recap session for the orientation week volunteers." },
  { title: "Monsoon Trek: Skandagiri", venue: "Bus from Main Gate", days: -30, capacity: 45, member: 60000, guest: 80000, description: "Night trek to the Skandagiri peak with breakfast at the top." },
  { title: "Spring Fundraiser Gala (draft)", venue: "Hotel Chancery Pavilion", days: 70, capacity: 300, member: 150000, guest: 250000, description: "Black-tie fundraiser for the scholarship fund. Pricing to be confirmed.", status: "draft" },
  { title: "Esports Tournament (draft)", venue: "Gaming Arena, Block D", days: 62, capacity: 64, member: 10000, guest: 20000, description: "Valorant and FIFA brackets. Waiting on sponsor confirmation.", status: "draft" },
];

const PRODUCTS = [
  { name: "MODE Club Hoodie", description: "Heavyweight 350 GSM fleece in charcoal with the embroidered MODE wordmark.", price: 129900, member: 99900, sizes: { S: 12, M: 20, L: 18, XL: 10 } },
  { name: "Rhythm 2026 Fest Tee", description: "Soft cotton tee with the Rhythm 2026 artwork on the back.", price: 59900, member: 44900, sizes: { S: 25, M: 40, L: 35, XL: 20, XXL: 8 } },
  { name: "Enamel Pin Set", description: "Three enamel pins: the club mark, the campus clock tower and a tiny samosa.", price: 24900, member: 19900, sizes: { "ONE SIZE": 60 } },
  { name: "Insulated Steel Bottle", description: "750 ml double-wall bottle, laser-etched MODE logo.", price: 89900, member: 74900, sizes: { "ONE SIZE": 30 } },
  { name: "Canvas Tote Bag", description: "Natural canvas tote printed with the club motto.", price: 34900, member: 24900, sizes: { "ONE SIZE": 45 } },
  { name: "Hackathon Cap", description: "Six-panel cap with the Hack the Campus patch.", price: 49900, member: 39900, sizes: { "ONE SIZE": 25 } },
  { name: "Notebook and Pen Kit", description: "A5 dotted notebook with a gel pen, both in club colours.", price: 29900, member: null, sizes: { "ONE SIZE": 50 } },
  { name: "Laptop Sticker Pack", description: "Twelve die-cut vinyl stickers. Waterproof.", price: 14900, member: 9900, sizes: { "ONE SIZE": 100 } },
  { name: "Varsity Jacket", description: "Wool-blend varsity jacket with leather sleeves. Limited run of 40.", price: 349900, member: 299900, sizes: { M: 12, L: 15, XL: 10 } },
  { name: "Trek Dry-fit Tee", description: "Quick-dry tee for the monsoon trek series.", price: 69900, member: 54900, sizes: { S: 10, M: 15, L: 15, XL: 8 } },
];

const PURPOSES = [
  ["Printing banners for the Diwali Mela", 420000], ["Snacks for hackathon mentors", 185000], ["Bus hire for the Skandagiri trek", 1250000], ["Projector lamp replacement", 650000],
  ["Trophies for the debate finals", 340000], ["Stationery for the orientation desk", 78000], ["Auto fare to collect sponsor cheques", 32000], ["Bluetooth speaker for movie night", 299900],
  ["Diyas and marigold for the mela", 215000], ["First-aid kit for the camp", 149000], ["Tea and biscuits for the alumni meeting", 96000], ["Domain renewal for club website", 119900],
  ["Extension cords and tape", 54000], ["Paint for the rangoli contest", 88000], ["Lanyards for volunteers", 162000], ["Popcorn machine rental", 250000],
  ["Mic hire for the fest auditions", 480000], ["Sponsor flex board", 390000], ["Photocopies of the judging sheets", 24000], ["Flowers for the chief guest", 60000],
  ["Prize vouchers for the showcase", 500000], ["Zoom licence for the online talk", 139900], ["Volunteer dinner after the gala setup", 720000], ["Cable ties and gaffer tape", 41000],
  ["Water cans for the blood camp", 90000], ["Canva Pro for poster design", 79900], ["Trekking poles for the first-timers", 310000], ["Battery packs for the photo walk", 118000],
  ["Certificates printing", 210000], ["Decor lights for the quadrangle", 560000], ["Whiteboard markers for the bootcamp", 36000], ["Snack boxes for the showcase jury", 145000],
  ["Petty cash: cleaning after the mela", 150000], ["Hoodie sample for sizing", 129900], ["Courier for sponsor kits", 68000], ["Tent rental for the fest stalls", 1800000],
];

const TASKS = [
  "Book the auditorium and confirm AV support", "Design the Diwali Mela poster", "Collect sponsor logos for the fest banner", "Set up the registration desk",
  "Print 200 volunteer lanyards", "Confirm the judges for the debate", "Arrange transport for the trek", "Test the projector and speakers",
  "Write the welcome email for freshers", "Order popcorn and drinks", "Brief the door volunteers on scanning", "Reconcile last month's dues with the treasurer",
  "Draft the alumni mixer invite", "Stock check on hoodies before the fest", "Set up the rangoli contest area", "Coordinate with the health centre for the camp",
  "Prepare the hackathon problem statements", "Book the photographer for the fest", "Update the club website calendar", "Collect feedback forms after the talk",
  "Arrange the chief guest's welcome", "Make the playlist for movie night", "Plan the bootcamp syllabus", "Count and bank the mela cash",
  "Send thank-you notes to sponsors", "Return the rented tents", "Check the fire exits for the fest", "Train two new scanners for the door",
  "Order trophies for the showcase", "Create the Instagram reel for Rhythm 2026", "Set up chairs in the seminar hall", "Clean the lab after the hackathon",
  "Get the mic stands from the music room", "Confirm the bus driver's contact", "Pack the first-aid kits", "File the receipts from the trek",
];

const ANNOUNCEMENTS = [
  ["Welcome to the new semester!", "Memberships are open. Pay your dues at the desk in Block C, Room 104, any weekday between 2 and 5 pm. Active members get member pricing on every event and in the shop."],
  ["Hack the Campus 2026: registrations open", "Teams of up to four. Book your seat under Events. Mentors from three Bengaluru startups have confirmed. Breakfast, lunch and dinner are on us."],
  ["Diwali Mela volunteers needed", "We need twenty volunteers for stalls, the rangoli contest and the lamp ceremony. Pick a task from the task board or message Rohan."],
  ["Door scanning starts this week", "Volunteers now scan tickets and member passes at the door. Keep your pass QR ready in the app. No screenshots of other people's QR, please."],
  ["New merch: hoodies and fest tees", "The MODE hoodie and the Rhythm 2026 tee are in the shop. Member pricing applies while your membership is active. Sizes are limited, so order early."],
  ["Reimbursements: how to claim", "Upload a photo of the receipt, submit the claim under My Expenses, and the treasurer will review it within three working days."],
  ["Blood donation camp on the 6th", "Register under Events to reserve a slot. Eat well and hydrate the night before. Walk-ins are welcome if slots are open."],
  ["Debate finals: judges confirmed", "Three judges from the Bangalore Debating Society will score the finals. Doors open at 5 pm. Free for members."],
  ["Photography walk: only 40 seats", "The heritage walk is almost full. If you booked and cannot come, cancel your hold so someone else can take the seat."],
  ["Fest early-bird pricing ends soon", "Rhythm 2026 tickets go up by ₹100 at the end of the month. Book now under Events."],
  ["Treasury update: September", "Dues and ticket income covered all September expenses with a surplus. The full ledger is visible to the treasurer and the club lead."],
  ["Lost and found", "A black umbrella and a blue water bottle were left after movie night. Collect them from the club room."],
];

// ── run ─────────────────────────────────────────────────────────────────────
async function main() {
  const health = await get("/api/health");
  log(`MODE at ${BASE} · ${health.database} schema v${health.schemaVersion}`);

  const admin = await login("lead@example.com");
  const organizer = await login("organizer@example.com");
  const treasurer = await login("treasurer@example.com");
  const volunteer = await login("volunteer@example.com");
  log(`signed in as lead, organizer, treasurer, volunteer`);

  // Members: register (or sign in), record dues for most, hand out a few roles.
  const members = [];
  for (const [name, slug] of PEOPLE) members.push({ name, ...(await loginOrRegister(name, `${slug}@nmit.ac.in`)) });
  log(`members ready: ${members.length}`);

  const directory = (await get("/api/members", admin.token)).members;
  const byEmail = new Map(directory.map((m) => [m.email, m]));
  const paying = members.slice(0, 22);
  for (const m of paying) {
    const row = byEmail.get(m.user.email);
    if (row?.membership === "active") continue;
    await post("/api/membership/dues", { memberId: m.user.id, reference: ref("UPI-DUES") }, treasurer.token);
    bump("dues payments");
  }
  // Two expired-looking members: leave unpaid. Roles for a handful.
  const roleChanges = [[members[0], "volunteer"], [members[1], "volunteer"], [members[2], "organizer"], [members[3], "volunteer"], [members[4], "treasurer"]];
  for (const [m, role] of roleChanges) {
    const row = byEmail.get(m.user.email);
    if (row?.role === role) continue;
    await patch(`/api/members/${m.user.id}/role`, { role }, admin.token);
    bump("role changes");
  }
  // Refresh sessions so promoted members carry their new permissions.
  for (const [m] of roleChanges) Object.assign(m, await login(m.user.email));
  const volunteers = [members[0], members[1], members[3], volunteer];
  const orgSecond = members[2];

  // Events.
  const existingEvents = (await get("/api/events", organizer.token)).events;
  const events = [];
  for (const e of EVENTS) {
    let found = existingEvents.find((x) => x.title === e.title);
    if (!found) {
      found = (await post("/api/events", { title: e.title, description: e.description, startsAt: daysFromNow(e.days, e.days % 2 ? 18 : 10, 0), venue: e.venue, capacity: e.capacity, memberPricePaise: e.member, guestPricePaise: e.guest, status: e.status ?? "published" }, organizer.token)).event;
      bump("events");
    }
    events.push({ ...found, days: e.days, draft: e.status === "draft" });
  }
  const bookable = events.filter((e) => !e.draft && e.days > 0);
  log(`events ready: ${events.length} (${bookable.length} bookable)`);

  // Tickets: members book, treasurer confirms most, some guests, some door scans.
  const tickets = [];
  for (const e of bookable) {
    const bookers = sample(members, Math.min(members.length, 4 + Math.floor(rand() * 6)));
    for (const m of bookers) {
      try {
        const t = (await post(`/api/events/${e.id}/tickets`, {}, m.token)).ticket;
        tickets.push({ ...t, event: e, owner: m });
        bump("tickets booked");
      } catch (err) { if (err.status !== 409) throw err; }
    }
    for (let g = 0; g < 1 + Math.floor(rand() * 3); g++) {
      const n = Math.floor(rand() * 9000 + 1000);
      try {
        const t = (await post(`/api/events/${e.id}/guest-tickets`, { name: pick(["Guest Kiran", "Guest Sameer", "Guest Leela", "Guest Farah", "Guest Tejas"]), email: `guest${n}@gmail.com` })).ticket;
        tickets.push({ ...t, event: e, guest: true });
        bump("guest tickets");
      } catch (err) { if (err.status !== 409) throw err; }
    }
  }
  const toConfirm = tickets.filter((t) => t.status === "pending_payment" && rand() < 0.72);
  for (const t of toConfirm) {
    const r = await post(`/api/tickets/${t.id}/confirm`, { reference: ref("UPI-TKT") }, treasurer.token);
    t.status = r.ticket.status; bump("tickets confirmed");
  }
  // Cancel a few holds so the states are all represented.
  for (const t of tickets.filter((t) => t.status === "pending_payment" && !t.guest).slice(0, 4)) {
    await post(`/api/tickets/${t.id}/cancel`, {}, t.owner.token); t.status = "cancelled"; bump("tickets cancelled");
  }
  // Door: scan paid tickets for the nearest two events as a volunteer.
  for (const e of bookable.slice(0, 2)) {
    for (const t of tickets.filter((t) => t.event.id === e.id && t.status === "paid").slice(0, 6)) {
      const r = await post(`/api/events/${e.id}/scan`, { credential: t.shortCode }, volunteer.token);
      if (r.outcome === "admitted") bump("door admissions");
    }
  }
  log(`tickets ready: ${tickets.length}`);

  // Products and orders.
  const existingProducts = (await get("/api/products", organizer.token)).products;
  const products = [];
  for (const p of PRODUCTS) {
    let found = existingProducts.find((x) => x.name === p.name);
    if (!found) {
      found = (await post("/api/products", { name: p.name, description: p.description, pricePaise: p.price, memberPricePaise: p.member, variants: Object.entries(p.sizes).map(([size, stock]) => ({ size, stock })) }, organizer.token)).product;
      bump("products");
    }
    products.push(found);
  }
  const orders = [];
  for (const m of members) {
    for (const p of sample(products, 1 + Math.floor(rand() * 2))) {
      const v = pick(p.variants.filter((v) => v.stock > 0) ?? []);
      if (!v) continue;
      try {
        const o = (await post("/api/orders", { variantId: v.id, quantity: rand() < 0.25 ? 2 : 1 }, m.token)).order;
        orders.push({ ...o, owner: m }); bump("orders placed");
      } catch (err) { if (err.status !== 409) throw err; }
    }
  }
  for (const o of orders.filter(() => rand() < 0.7)) {
    const r = await post(`/api/orders/${o.id}/confirm`, { reference: ref("UPI-SHOP") }, treasurer.token);
    o.status = r.order.status; bump("orders confirmed");
  }
  for (const o of orders.filter((o) => o.status === "paid" && rand() < 0.55)) {
    await post(`/api/orders/${o.id}/fulfil`, {}, organizer.token); o.status = "fulfilled"; bump("orders fulfilled");
  }
  for (const o of orders.filter((o) => o.status === "pending_payment").slice(0, 3)) {
    await post(`/api/orders/${o.id}/cancel`, {}, o.owner.token); o.status = "cancelled"; bump("orders cancelled");
  }
  log(`orders ready: ${orders.length}`);

  // Receipts and reimbursement claims: volunteers and organizers submit, treasurer reviews.
  const submitters = [...volunteers, orgSecond, organizer, ...members.slice(5, 9)];
  const expenses = [];
  for (let i = 0; i < PURPOSES.length; i++) {
    const [purpose, amount] = PURPOSES[i];
    const who = submitters[i % submitters.length];
    const png = await QRCode.toBuffer(`MODE receipt · ${purpose} · ₹${(amount / 100).toFixed(2)} · ${ref("BILL")}`, { type: "png", width: 320, margin: 2 });
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), `receipt-${i + 1}.png`);
    const receipt = await call("POST", "/api/receipts", { token: who.token, form });
    bump("receipts uploaded");
    const event = rand() < 0.6 ? pick(events.filter((e) => !e.draft)) : null;
    const expense = await post("/api/expenses", { amountPaise: amount, purpose, receiptId: receipt.id, receiptReference: ref("BILL"), ...(event ? { eventId: event.id } : {}) }, who.token);
    expenses.push(expense); bump("expense claims");
  }
  const reviewer = treasurer.token;
  const shuffled = sample(expenses, expenses.length);
  const approve = shuffled.slice(0, 20), reject = shuffled.slice(20, 25);
  for (const x of approve) { await post(`/api/expenses/${x.id}/approve`, {}, reviewer); bump("expenses approved"); }
  for (const x of reject) { await post(`/api/expenses/${x.id}/reject`, { note: pick(["Receipt is for a personal item.", "Already reimbursed in September.", "Need the GST invoice, not the estimate.", "Over the ₹5,000 limit without prior approval."]) }, reviewer); bump("expenses rejected"); }
  for (const x of approve.slice(0, 12)) { await post(`/api/expenses/${x.id}/pay`, { paymentReference: ref("NEFT") }, reviewer); bump("expenses paid"); }
  log(`expenses ready: ${expenses.length}`);

  // Tasks across the board, some done, some in progress, some overdue.
  const assignees = [...volunteers, orgSecond, ...members.slice(5, 14)];
  const existingTasks = await get("/api/tasks", organizer.token);
  const tasks = [];
  for (let i = 0; i < TASKS.length; i++) {
    const title = TASKS[i];
    let t = existingTasks.find((x) => x.title === title);
    if (!t) {
      const assignee = rand() < 0.85 ? pick(assignees) : null;
      const event = rand() < 0.7 ? pick(events.filter((e) => !e.draft)) : null;
      const due = daysFromNow(-6 + Math.floor(rand() * 40), 18, 0);
      t = await post("/api/tasks", { title, description: pick(["Coordinate with the venue and keep the group chat updated.", "Ask the treasurer before spending anything above ₹2,000.", "Share a photo in the volunteers group when done.", "Check with the organizer if anything is unclear.", ""]) || undefined, ...(assignee ? { assigneeId: assignee.user.id } : {}), ...(event ? { eventId: event.id } : {}), dueAt: due }, organizer.token);
      bump("tasks");
      const roll = rand();
      if (roll < 0.33) { await post(`/api/tasks/${t.id}/status`, { status: "done" }, organizer.token); bump("tasks done"); }
      else if (roll < 0.6) { await post(`/api/tasks/${t.id}/status`, { status: "in_progress" }, organizer.token); bump("tasks in progress"); }
    }
    tasks.push(t);
  }
  log(`tasks ready: ${tasks.length}`);

  // Announcements fan out to every active member as notifications and outbox rows.
  for (const [title, body] of ANNOUNCEMENTS) {
    const r = await post("/api/announcements", { idempotencyKey: `demo-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`, title, body }, organizer.token);
    if (r.created) { bump("announcements"); bump("notifications (announcement)", r.recipientCount); }
  }
  const reminders = await post("/api/membership/reminders/run", { days: 365 }, organizer.token);
  bump("notifications (reminders)", reminders.sent);

  // Club name: a direct SQLite update, since renaming has no API.
  if (args["club-name"] && args["club-name"] !== "true") {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(args.sqlite ?? ".data/mode.sqlite");
    db.prepare("UPDATE clubs SET name = ?, description = ? WHERE id = (SELECT id FROM clubs ORDER BY rowid LIMIT 1)").run(args["club-name"], args["club-description"] ?? "NMIT's student collective for tech, culture and community: memberships, events, merchandise, volunteers and one shared ledger.");
    db.close();
    bump("club renamed");
  }

  // Summary.
  const dash = await get("/api/dashboard", admin.token);
  const summary = await get("/api/ledger/summary", treasurer.token);
  log("\nCreated this run:");
  for (const [k, v] of Object.entries(counts).sort()) log(`  ${k.padEnd(30)} ${v}`);
  log(`\nClub now: ${dash.metrics.members} members (${dash.metrics.activeMembers} active), ${dash.metrics.upcomingEvents} upcoming events, balance ₹${(summary.balancePaise / 100).toFixed(2)}`);
  log(`Sign in as any seeded person with their @nmit.ac.in email and the password "${PASSWORD}" (e.g. aarav.mehta@nmit.ac.in is a volunteer, rohan.kulkarni@nmit.ac.in an organizer, kabir.singh@nmit.ac.in a treasurer).`);
}

main().catch((err) => { console.error("\nSeeding failed:", err.message); if (err.body) console.error(err.body); process.exit(1); });
