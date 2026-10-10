# Deferred work

- Real email and WhatsApp dispatch are outside the MVP. Announcement outbox rows represent simulated delivery only. A future dispatcher needs provider configuration, verified sender identities, retry/error handling and provider-level idempotency before it can claim actual delivery.
- The announcement publishing form, recipient inbox and officer outbox screens are tracked in [#12](https://github.com/nitishssh/MODE/issues/12). The existing website exposes the public announcement archive; backend contracts and an API walkthrough are in [API.md](docs/API.md#announcements-and-simulated-delivery-schema-v11-8) and [DEMO.md](docs/DEMO.md#announcement-publication-8).
