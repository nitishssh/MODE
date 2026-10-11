import { randomUUID } from "node:crypto";
import type { DbContext, Row } from "../db/core";
import { openwaClient } from "../openwa/client";
import type { IdentityModule } from "./identity";

export interface WhatsAppPreferences {
  phone: string | null;
  optIn: boolean;
}

export interface WhatsAppDelivery {
  recipientId: string;
  phone: string;
  messageId: string;
  status: "pending" | "sent" | "delivered" | "failed";
  createdAt: string;
}

export function createWhatsAppModule(ctx: DbContext, identity: IdentityModule) {
  const { db } = ctx;

  /**
   * Get WhatsApp preferences for a member
   */
  function getPreferences(clubId: string, memberId: string): WhatsAppPreferences {
    const row = db
      .prepare(
        "SELECT whatsapp_phone, whatsapp_opt_in FROM members WHERE club_id = ? AND id = ?"
      )
      .get(clubId, memberId) as
      | (Row & { whatsapp_phone: string | null; whatsapp_opt_in: number })
      | undefined;

    if (!row) {
      throw new Error(`Member ${memberId} not found`);
    }

    return {
      phone: row.whatsapp_phone,
      optIn: row.whatsapp_opt_in === 1,
    };
  }

  /**
   * Set WhatsApp preferences for a member
   */
  function setPreferences(
    clubId: string,
    memberId: string,
    phone: string | null,
    optIn: boolean
  ): void {
    db.prepare(
      "UPDATE members SET whatsapp_phone = ?, whatsapp_opt_in = ? WHERE club_id = ? AND id = ?"
    ).run(phone, optIn ? 1 : 0, clubId, memberId);
  }

  /**
   * Send announcement via WhatsApp to opted-in members with phone numbers
   */
  async function sendAnnouncement(
    clubId: string,
    announcementId: string,
    title: string,
    body: string,
    clubName?: string
  ): Promise<{
    sent: number;
    failed: number;
    deliveryIds: string[];
  }> {
    // Get opted-in members with phone numbers
    const recipients = db
      .prepare(
        `SELECT id, email, whatsapp_phone FROM members
       WHERE club_id = ?
       AND whatsapp_opt_in = 1
       AND whatsapp_phone IS NOT NULL
       ORDER BY id`
      )
      .all(clubId) as Array<
      Row & { id: string; email: string; whatsapp_phone: string }
    >;

    if (recipients.length === 0) {
      return { sent: 0, failed: 0, deliveryIds: [] };
    }

    // Check OpenWA health
    const isHealthy = await openwaClient.health();
    if (!isHealthy) {
      console.warn("OpenWA is not available, storing as pending");
    }

    // Format message for WhatsApp
    const message = openwaClient.formatAnnouncement(title, body, clubName);
    const deliveryIds: string[] = [];
    let sent = 0;
    let failed = 0;

    // Send to each recipient
    for (const recipient of recipients) {
      const deliveryId = randomUUID();

      try {
        if (isHealthy) {
          // Send immediately if OpenWA is available
          const response = await openwaClient.sendMessage(
            recipient.whatsapp_phone,
            message
          );

          // Record delivery
          db.prepare(
            `INSERT INTO outbox_messages
            (id, club_id, member_id, kind, recipient_email, subject, body, status,
             created_at, announcement_id, whatsapp_message_id, whatsapp_status)
            VALUES (?, ?, ?, 'announcement', ?, ?, ?, 'whatsapp', ?, ?, ?, 'sent')`
          ).run(
            deliveryId,
            clubId,
            recipient.id,
            recipient.email,
            title,
            message,
            new Date().toISOString(),
            announcementId,
            response.id
          );

          sent++;
        } else {
          // Store as pending if OpenWA is unavailable
          db.prepare(
            `INSERT INTO outbox_messages
            (id, club_id, member_id, kind, recipient_email, subject, body, status,
             created_at, announcement_id, whatsapp_status)
            VALUES (?, ?, ?, 'announcement', ?, ?, ?, 'whatsapp', ?, ?, 'pending')`
          ).run(
            deliveryId,
            clubId,
            recipient.id,
            recipient.email,
            title,
            message,
            new Date().toISOString(),
            announcementId
          );

          sent++;
        }

        deliveryIds.push(deliveryId);
      } catch (error) {
        console.error(
          `Failed to send WhatsApp message to ${recipient.whatsapp_phone}:`,
          error
        );

        // Record failed delivery
        db.prepare(
          `INSERT INTO outbox_messages
          (id, club_id, member_id, kind, recipient_email, subject, body, status,
           created_at, announcement_id, whatsapp_status)
          VALUES (?, ?, ?, 'announcement', ?, ?, ?, 'whatsapp', ?, ?, 'failed')`
        ).run(
          deliveryId,
          clubId,
          recipient.id,
          recipient.email,
          title,
          message,
          new Date().toISOString(),
          announcementId
        );

        failed++;
        deliveryIds.push(deliveryId);
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return { sent, failed, deliveryIds };
  }

  /**
   * Get delivery status for an announcement
   */
  function getDeliveryStatus(
    clubId: string,
    announcementId: string
  ): WhatsAppDelivery[] {
    const rows = db
      .prepare(
        `SELECT member_id, recipient_email, whatsapp_message_id, whatsapp_status, created_at
       FROM outbox_messages
       WHERE club_id = ? AND announcement_id = ? AND status = 'whatsapp'
       ORDER BY created_at`
      )
      .all(clubId, announcementId) as Array<
      Row & {
        member_id: string;
        recipient_email: string;
        whatsapp_message_id: string | null;
        whatsapp_status: string;
        created_at: string;
      }
    >;

    return rows.map((row) => ({
      recipientId: row.member_id,
      phone: row.recipient_email, // We'll update this to use whatsapp_phone if needed
      messageId: row.whatsapp_message_id || "unknown",
      status: (row.whatsapp_status as any) || "pending",
      createdAt: row.created_at,
    }));
  }

  /**
   * Update delivery status from webhook
   */
  function updateDeliveryStatus(
    messageId: string,
    status: "sent" | "delivered" | "failed"
  ): void {
    db.prepare(
      "UPDATE outbox_messages SET whatsapp_status = ? WHERE whatsapp_message_id = ?"
    ).run(status, messageId);
  }

  return {
    getPreferences,
    setPreferences,
    sendAnnouncement,
    getDeliveryStatus,
    updateDeliveryStatus,
  };
}

export type WhatsAppModule = ReturnType<typeof createWhatsAppModule>;
