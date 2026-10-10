# Issue #14: remaining work

Issue: https://github.com/nitishssh/MODE/issues/14

Status: In progress. This is a draft handoff checklist, not an implementation or acceptance sign-off.

Owners: @nitishssh.

Snapshot: 10 October 2026, main `771ec78d7ecec9e5c0d597951877e5968ead7e84`. Recheck this snapshot when implementation resumes; the linked issue remains the acceptance source of truth.

## Existing work

PR #20 provides development CORS; #21 provides LAN commands, loopback defaults and PWA metadata. PR #26 adds automated server-restart persistence verification for the foundation; it does not verify a physical phone, Expo Go or hosted receipt persistence.

## Dependencies

#2 auth/CORS and #10 Expo export. Final platform smoke depends on #11–#13.

## Completion checklist

- [ ] Verify a physical phone on the same Wi-Fi reaches health, signs in and checks in a ticket by typed code using EXPO_PUBLIC_API_URL.
- [ ] Serve #10's Expo web export at / with SPA fallback while preserving /api routes and same-origin HttpOnly-cookie authentication.
- [ ] Verify development CORS against the configured allowlist, including PATCH and rejection of unlisted origins.
- [ ] Record Android and iOS Expo Go verification and Windows Edge PWA installation unless the approved fallback is explicitly invoked.
- [ ] Record the portal URL/video requirements decision. Deploy only if required, using a single writable instance and persistent database/receipt storage.
- [ ] For any hosted build, document environment, migrations, health and rollback, then verify member records and receipts survive restart.
- [ ] Add client checks and contract drift detection to CI; document the platforms actually verified and outstanding limitations.

## Evidence required before completion

Link the implementation commits and passing checks; record reproducible demo steps and any required physical-device evidence. Keep unchecked items visible and do not mark the issue complete because this checklist is merged. Payments and outbox delivery remain simulated under the MVP scope. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.
