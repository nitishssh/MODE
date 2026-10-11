import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: string; note: string }> = {
  pending_payment: { label: "Payment pending", tone: "amber", note: "Pay a club officer before expiry. Pending tickets do not permit admission." },
  paid: { label: "Paid · ready for the door", tone: "green", note: "Show this screen at the door. The volunteer scans the code or types it." },
  cancelled: { label: "Cancelled", tone: "muted", note: "This ticket was cancelled. Book again if you still want a seat." },
  expired: { label: "Hold expired", tone: "red", note: "Hold expired, rebook. The seat was released when the 30-minute hold lapsed." },
};

/** Guest ticket link: the holder's view, resolved by the random QR token only. */
export const GET = route<{ token: string }>(
  "public ticket",
  async (request, { token }) => {
    const ticket = getDatabase().events.publicTicket(token);
    if (!request.headers.get("accept")?.includes("text/html"))
      return json({ ticket });
    const escape = (value: string) =>
      value.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c]!,
      );
    // The QR carries this page's own link, so a phone camera reopens the ticket and the door scanner still resolves the token.
    const selfUrl = new URL(request.url);
    const qr = await QRCode.toString(`${selfUrl.origin}/t/${encodeURIComponent(token)}`, {
      type: "svg",
      margin: 1,
      width: 220,
      color: { dark: "#24201e", light: "#ffffff" },
    });
    const price = ticket.pricePaise === 0
      ? "Free"
      : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(ticket.pricePaise / 100);
    const when = (iso: string | null) => {
      if (!iso) return "";
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
    };
    const dayTile = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return { month: "", day: "" };
      return {
        month: new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(d).toUpperCase(),
        day: new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(d),
      };
    };
    const status = STATUS_COPY[ticket.status] ?? { label: ticket.status, tone: "muted", note: "" };
    const tile = dayTile(ticket.event.startsAt);
    const admitted = ticket.checkedInAt ? `<p class="line ok">✓ Admitted ${escape(when(ticket.checkedInAt))}</p>` : "";
    const hold = ticket.holdExpiresAt && ticket.status === "pending_payment"
      ? `<p class="line warn">Hold expires ${escape(when(ticket.holdExpiresAt))}. ${escape(status.note)}</p>`
      : status.note ? `<p class="line ${status.tone === "green" ? "ok" : status.tone === "red" ? "bad" : ""}">${escape(status.note)}</p>` : "";

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(ticket.event.title)} · MODE ticket</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f5f0e8 radial-gradient(circle,#b8785d26 1px,transparent 1.25px);background-size:16px 16px;color:#24201e;font:15px/1.55 "DM Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:420px}
.brand{display:flex;align-items:center;gap:8px;margin:0 0 16px 4px;font:700 24px "Crimson Pro",Georgia,serif;letter-spacing:-.5px}
.brand i{display:inline-flex;gap:2px;height:22px}.brand i b{display:block;width:4px;border-radius:4px;background:#cc785c;transform:rotate(-20deg)}.brand i b:nth-child(2){background:#f0a500;height:14px;margin-top:4px}.brand i b:nth-child(3){background:#2e7d5b;height:19px}
.brand em{color:#cc785c;font-style:normal}
.ticket{background:#fefcf9;border:1px solid #ded8cf;border-radius:20px;box-shadow:0 18px 44px #24201e1f;overflow:hidden}
.head{padding:22px 22px 18px;display:flex;gap:16px;align-items:flex-start}
.tile{flex-shrink:0;width:58px;height:66px;border-radius:12px;background:#f4e1d9;color:#a95638;display:flex;flex-direction:column;align-items:center;justify-content:center}
.tile span{font-size:10px;font-weight:700;letter-spacing:.8px}.tile strong{font-size:26px;line-height:1.1;font-weight:600}
.kicker{font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#8b8178;margin:0 0 6px}
h1{margin:0;font:600 26px/1.15 "Crimson Pro",Georgia,serif;letter-spacing:-.5px;overflow-wrap:anywhere}
.meta{margin:8px 0 0;color:#716a63;font-size:13px}
.rip{position:relative;height:0;border-top:2px dashed #e5ddd2;margin:0 14px}
.rip:before,.rip:after{content:"";position:absolute;top:-13px;width:24px;height:24px;border-radius:50%;background:#f5f0e8;border:1px solid #ded8cf}
.rip:before{left:-27px}.rip:after{right:-27px}
.body{padding:20px 22px 22px;text-align:center}
.holder{margin:0;font-weight:700;font-size:17px;overflow-wrap:anywhere}
.pill{display:inline-block;margin:10px 0 16px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700}
.pill.green{background:#eaf3e9;color:#28714f}.pill.amber{background:#fff3df;color:#9a7a41}.pill.red{background:#fbede6;color:#b57b5f}.pill.muted{background:#f0f3f2;color:#7d8a8b}
.qr{display:inline-block;padding:10px;background:#fff;border:1px solid #ded8cf;border-radius:14px}
.qr svg{display:block;width:200px;height:200px}
.label{margin:16px 0 4px;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#8b8178}
code{display:block;font:600 30px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:5px;color:#24201e}
.price{margin:14px 0 0;color:#716a63;font-size:13px}.price b{color:#24201e;font-size:16px}
.line{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#f7f2eb;color:#5c5c5c;font-size:13px;text-align:left}
.line.ok{background:#eaf3e9;color:#28714f}.line.warn{background:#fff3df;color:#6b4410}.line.bad{background:#fbede6;color:#8c3b2e}
.foot{margin:14px 4px 0;color:#8b8178;font-size:12px;text-align:center}
.foot a{display:inline-block;margin-top:8px;padding:10px 18px;border-radius:999px;background:#cc785c;color:#fff;font-weight:700;text-decoration:none}
</style></head><body><main>
<p class="brand"><i><b></b><b></b><b></b></i>MODE<em>.</em></p>
<section class="ticket" aria-label="Ticket">
<div class="head"><div class="tile"><span>${escape(tile.month)}</span><strong>${escape(tile.day)}</strong></div><div><p class="kicker">Event ticket</p><h1>${escape(ticket.event.title)}</h1><p class="meta">${escape(when(ticket.event.startsAt))}<br>${escape(ticket.event.venue)}</p></div></div>
<div class="rip"></div>
<div class="body">
<p class="holder">${escape(ticket.holderName)}</p>
<span class="pill ${status.tone}">${escape(status.label)}</span>
<div class="qr">${qr}</div>
<p class="label">Door code</p><code>${escape(ticket.shortCode)}</code>
<p class="price">Ticket price <b>${escape(price)}</b></p>
${admitted}${hold}
</div></section>
<p class="foot">Keep this private link to check your ticket. Payments are recorded by officers.<br><a href="">Refresh ticket status</a></p>
</main></body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "Accept",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  },
);
