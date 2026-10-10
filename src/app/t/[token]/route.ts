import { getDatabase } from "../../../lib/database";
import { json, route } from "../../../lib/http";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const qr = await QRCode.toString(token, {
      type: "svg",
      margin: 2,
      width: 220,
    });
    const price = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(ticket.pricePaise / 100);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MODE guest ticket</title><style>body{font:18px/1.6 system-ui;background:#faf7ef;color:#302921;padding:24px}main{max-width:600px;margin:auto}svg{display:block;background:white}code{font-size:28px}a{color:#8b3e24}</style></head><body><main><h1>${escape(ticket.event.title)}</h1><p>${escape(ticket.event.venue)} · ${escape(ticket.event.startsAt)}</p><h2>${escape(ticket.holderName)}</h2><p>Status: <strong>${escape(ticket.status)}</strong> · ${price}</p>${qr}<code>${escape(ticket.shortCode)}</code>${ticket.holdExpiresAt && ticket.status === "pending_payment" ? `<p>Hold expires ${escape(ticket.holdExpiresAt)}. Pay a club officer before expiry. Pending tickets do not permit admission.</p>` : ""}${ticket.status === "expired" ? "<p>Hold expired, rebook.</p>" : ""}${ticket.checkedInAt ? `<p>Admitted ${escape(ticket.checkedInAt)}</p>` : ""}<p>Keep this private link to check your ticket. Payments are recorded by officers.</p><a href="">Refresh ticket status</a></main></body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        Vary: "Accept",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  },
);
