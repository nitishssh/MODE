import { getDatabase } from "../../../../lib/database";
import { json, route } from "../../../../lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OpenWA webhook payload schema
const openwaWebhookSchema = z.object({
  event: z.string(),
  instance: z.string(),
  data: z.record(z.string(), z.unknown()),
});

/**
 * Handle webhooks from OpenWA for message delivery status updates.
 * OpenWA sends events like:
 * - message:create (incoming message)
 * - message:ack (delivery confirmation with ack level: 1=sent, 2=delivered, 3=read)
 */
export const POST = route("openwa webhook", async (request, _params) => {
  const db = getDatabase();

  try {
    const body = await request.json();
    const payload = openwaWebhookSchema.parse(body);

    // Handle message acknowledgment (delivery status)
    if (payload.event === "message:ack" && payload.data.ack !== undefined) {
      const ack = payload.data.ack;
      const id = payload.data.id as string | undefined;

      if (typeof ack === "number" && id) {
        // ack levels: 1=sent, 2=delivered, 3=read
        // Map to our status system
        const status: "sent" | "delivered" | "failed" = ack >= 2 ? "delivered" : "sent";

        // Update the outbox message status
        db.whatsapp.updateDeliveryStatus(id, status);

        return json({
          success: true,
          message: "Delivery status updated",
          id,
          status,
        });
      }
    }

    // Handle incoming messages (for future chatbot features)
    if (payload.event === "message:create") {
      const messageId = payload.data.id as string | undefined;
      console.log(`Received incoming message: ${messageId}`);
      // Future: implement message handling logic
    }

    // Acknowledge receipt of webhook
    return json({
      success: true,
      message: "Webhook processed",
      event: payload.event,
    });
  } catch (error) {
    console.error("OpenWA webhook error:", error);
    return json(
      { error: "Failed to process webhook", details: String(error) },
      { status: 400 }
    );
  }
});
