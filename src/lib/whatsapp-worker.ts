import type { WhatsAppClaim, WhatsAppModule, WhatsAppOutcome } from "./modules/whatsapp";

/** Implement against the verified rmyndharis/OpenWA API before enabling a real sender.
 * `failed` means the provider definitively did not accept the request. An unknown
 * response, timeout, or connection loss MUST be uncertain, never blindly retried.
 */
export interface WhatsAppTransport {
  send(message: WhatsAppClaim, signal: AbortSignal): Promise<WhatsAppOutcome>;
}

export async function runWhatsAppBatch(queue: WhatsAppModule, clubId: string, transport?: WhatsAppTransport, limit = 10) {
  if (!transport) return { enabled: false, processed: 0 };
  const count = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 0;
  let processed = 0;
  for (let index = 0; index < count; index++) {
    const claim = queue.claimNext(clubId);
    if (!claim) break;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<WhatsAppOutcome>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ status: "uncertain", code: "submission_unknown" });
        }, 30_000);
      });
      const outcome = await Promise.race([transport.send(claim, controller.signal), timeout]);
      if (outcome.status === "accepted" && !outcome.messageId?.trim()) throw new Error("Missing provider message ID");
      queue.settle(claim, outcome);
    } catch {
      // Provider exceptions can include tokens or phone numbers; persist only a fixed code.
      queue.settle(claim, { status: "uncertain", code: "submission_unknown" });
    } finally {
      if (timer) clearTimeout(timer);
    }
    processed++;
  }
  return { enabled: true, processed };
}
