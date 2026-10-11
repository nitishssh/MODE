/**
 * OpenWA API Client for WhatsApp integration.
 * Communicates with the Open-WA gateway to send WhatsApp messages.
 */

interface OpenWASession {
  sessionId: string;
  status: "STARTING" | "CONNECTED" | "DISCONNECTED" | "DEPRECATED";
  description?: string;
}

interface OpenWASendMessageRequest {
  to: string; // WhatsApp number in format: 918181818181 or with @c.us suffix
  body: string;
  mentions?: string[]; // Numbers to mention in group messages
}

interface OpenWASendMessageResponse {
  id: string;
  status: "sent" | "pending";
  timestamp: number;
}

interface OpenWAWebhookEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
}

export class OpenWAClient {
  private baseUrl: string;
  private apiKey: string;
  private sessionId: string;

  constructor(
    baseUrl: string = process.env.OPENWA_API_URL || "http://127.0.0.1:2785",
    apiKey: string = process.env.OPENWA_API_KEY || "default-key",
    sessionId: string = process.env.OPENWA_SESSION_ID || "default"
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = apiKey;
    this.sessionId = sessionId;
  }

  /**
   * Check if OpenWA is healthy and accessible
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: "GET",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available sessions
   */
  async getSessions(): Promise<OpenWASession[]> {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }

    const data = (await response.json()) as { sessions: OpenWASession[] };
    return data.sessions;
  }

  /**
   * Send a message to a WhatsApp number
   */
  async sendMessage(
    to: string,
    message: string,
    mentions?: string[]
  ): Promise<OpenWASendMessageResponse> {
    // Ensure phone number is in correct format (without +)
    const phoneNumber = to.replace(/^\+/, "");

    const payload: OpenWASendMessageRequest = {
      to: `${phoneNumber}@c.us`,
      body: message,
      mentions,
    };

    const response = await fetch(
      `${this.baseUrl}/api/sessions/${this.sessionId}/messages/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${response.status} ${error}`);
    }

    const data = (await response.json()) as OpenWASendMessageResponse;
    return data;
  }

  /**
   * Send a message to multiple recipients
   */
  async sendBulkMessages(
    recipients: Array<{ phone: string; message: string }>,
    options?: { delayMs?: number }
  ): Promise<OpenWASendMessageResponse[]> {
    const results: OpenWASendMessageResponse[] = [];
    const delayMs = options?.delayMs ?? 100;

    for (const { phone, message } of recipients) {
      try {
        const result = await this.sendMessage(phone, message);
        results.push(result);
        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        // Log but continue with other recipients
        console.error(`Failed to send message to ${phone}:`, error);
      }
    }

    return results;
  }

  /**
   * Format announcement for WhatsApp
   */
  formatAnnouncement(title: string, body: string, clubName?: string): string {
    const header = clubName ? `🔔 *${clubName}*\n` : "🔔 ";
    const titleLine = `*${title}*\n`;
    return `${header}${titleLine}\n${body}`;
  }

  /**
   * Extract phone number from message (for webhook handling)
   */
  static parseWhatsAppNumber(fullNumber: string): string {
    return fullNumber.replace(/@[a-z.]+$/, "");
  }
}

export const openwaClient = new OpenWAClient();
