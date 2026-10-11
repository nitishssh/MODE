# Open-WA WhatsApp Integration

MODE now supports sending announcements via WhatsApp using [Open-WA](https://www.open-wa.org/), a free, self-hosted WhatsApp API gateway.

## Quick Start

### 1. Start Open-WA

```bash
npm run openwa:up
```

This starts an Open-WA instance on `http://localhost:2785` with the dashboard at the same address.

### 2. Set up WhatsApp Session

1. Open the Open-WA dashboard: http://localhost:2785
2. Create a new session or use the default one
3. Scan the QR code with your phone number's WhatsApp
4. Once connected, note the session ID (default: "default")

### 3. Configure MODE

Set environment variables in `.env.local`:

```bash
# Open-WA API endpoint (defaults to localhost:2785)
OPENWA_API_URL=http://127.0.0.1:2785

# API key for authentication (set in Open-WA dashboard)
OPENWA_API_KEY=your-api-key

# Session ID to use (defaults to "default")
OPENWA_SESSION_ID=default
```

### 4. Members Enable WhatsApp

Members can enable WhatsApp notifications by:

1. Going to Settings in the MODE app
2. Adding their WhatsApp phone number (format: +1234567890 or 1234567890)
3. Opting in to WhatsApp announcements

**API endpoint:**
```
PATCH /api/members/{memberId}/whatsapp
Content-Type: application/json

{
  "phone": "+919876543210",
  "optIn": true
}
```

### 5. Send Announcements

When organizers publish announcements through the MODE workspace, they are automatically sent via WhatsApp to all opted-in members with phone numbers.

## Architecture

### Database Schema

New columns added in migration v14:

- `members.whatsapp_phone` - Member's WhatsApp phone number
- `members.whatsapp_opt_in` - Boolean opt-in preference
- `outbox_messages.whatsapp_message_id` - Message ID from Open-WA
- `outbox_messages.whatsapp_status` - Delivery status (pending, sent, delivered, failed)

### Modules

**`src/lib/openwa/client.ts`** - Open-WA API client
- `sendMessage(to, message)` - Send single message
- `sendBulkMessages(recipients)` - Send to multiple recipients
- `formatAnnouncement(title, body, clubName)` - Format for WhatsApp
- `health()` - Check Open-WA availability

**`src/lib/modules/whatsapp.ts`** - WhatsApp delivery module
- `getPreferences(clubId, memberId)` - Get phone and opt-in status
- `setPreferences(clubId, memberId, phone, optIn)` - Update preferences
- `sendAnnouncement(clubId, announcementId, title, body)` - Send announcement
- `getDeliveryStatus(clubId, announcementId)` - Check delivery status
- `updateDeliveryStatus(messageId, status)` - Update from webhooks

### API Routes

**Member WhatsApp Settings:**
```
GET /api/members/{id}/whatsapp
  Returns: { phone, optIn, openwaAvailable }

PATCH /api/members/{id}/whatsapp
  Body: { phone?, optIn? }
  Returns: { phone, optIn, message }
```

**Open-WA Webhooks:**
```
POST /api/webhooks/whatsapp
  Handles: message:create, message:ack events
  Updates delivery status in outbox_messages
```

## Behavior

### When Announcement is Published

1. Announcement is saved to the database
2. Notifications are created for all active members (existing behavior)
3. Outbox entries are created for simulated email delivery (existing behavior)
4. **NEW:** If Open-WA is configured and available:
   - For each member with `whatsapp_opt_in = 1` and a phone number:
     - Message is sent via Open-WA
     - Delivery record is created in `outbox_messages` with `status = 'whatsapp'`
   - If Open-WA is unavailable:
     - Messages are stored as pending in `outbox_messages`
     - Can be retried once Open-WA is back online

### Message Formatting

Announcements are formatted for WhatsApp:

```
🔔 *Club Name*
*Announcement Title*

Announcement body text here...
```

### Delivery Tracking

Open-WA sends webhooks when messages are acknowledged:

- `message:ack` with `ack: 1` → "sent"
- `message:ack` with `ack: 2+` → "delivered"

Organizers can inspect delivery status via:

```
GET /api/announcements/{id}/outbox
```

The response includes all WhatsApp delivery records with their status.

## Troubleshooting

### Open-WA is not running

```bash
npm run openwa:logs
```

Check the container logs for errors.

### WhatsApp messages not sending

1. **Check Open-WA health:**
   ```bash
   curl http://localhost:2785/api/health
   ```

2. **Verify session is connected:**
   ```bash
   curl http://localhost:2785/api/sessions \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Check environment variables:**
   ```bash
   echo $OPENWA_API_URL
   echo $OPENWA_API_KEY
   echo $OPENWA_SESSION_ID
   ```

4. **Verify phone numbers:**
   - Phone numbers must be in E.164 format: `+1234567890`
   - Country code is required
   - No spaces or dashes

5. **Check rate limiting:**
   - Default: 30 messages per minute per session
   - Reduce `RATE_LIMIT_MAX` in `docker-compose.openwa.yml` if needed

### Members not receiving messages

1. **Did they opt in?**
   - Check `members.whatsapp_opt_in = 1` in database

2. **Did they provide a phone number?**
   - Check `members.whatsapp_phone` is not NULL

3. **Is membership active?**
   - WhatsApp announcement respects the same membership filter as email

## Development

### Running Tests

```bash
npm run test
```

The test fixtures don't require Open-WA; messages are stored as pending.

### Local Development

```bash
npm run dev              # Start MODE API and web
npm run openwa:up       # Start Open-WA in another terminal
```

The webhook URL in `docker-compose.openwa.yml` is configured for localhost:

```
WEBHOOK_URL: "http://127.0.0.1:3000/api/webhooks/whatsapp"
```

For LAN testing, update this to your machine's IP.

### Production Deployment

1. **Use managed Open-WA** (recommended) or self-host securely
2. **Update webhook URL** to your production domain
3. **Set secure environment variables** via your hosting platform
4. **Configure persistent storage** for Open-WA sessions
5. **Set up rate limiting** appropriate for your club size

## Limitations

- One WhatsApp number per MODE session
- Phone numbers must be in E.164 format
- Messages are plain text (no images/media yet)
- Open-WA must remain running for deliveries to work
- Account safety depends on responsible usage (avoid spam/abuse)

## Future Enhancements

- [ ] Support for group announcements via WhatsApp groups
- [ ] Media attachments (images, documents)
- [ ] Incoming message handling (chatbot features)
- [ ] Message templates for consistency
- [ ] Delivery retry logic with exponential backoff
- [ ] Analytics dashboard for engagement tracking

## Resources

- [Open-WA Documentation](https://www.open-wa.org/)
- [Open-WA API Reference](https://www.open-wa.org/)
- [MODE Database Schema](DATA-MODEL.md)
- [MODE API Contracts](API.md)
