# Issue #14: remaining work

Issue: https://github.com/nitishssh/MODE/issues/14

Status: In progress. Platform plumbing is merged; physical-device, installed-PWA and conditional hosting acceptance remain open. This checklist does not close issue #14.

Owner: @nitishssh.

Snapshot: 10 October 2026, main `1e98171da7041f0bd92f5be94cf64d351b38afdb`. Recheck against the linked issue when work resumes.

## Delivered foundations

- `dev:lan` and `start:lan` bind to `0.0.0.0`; ordinary `dev` and `start` retain loopback. The client documents `EXPO_PUBLIC_API_URL` for the native API origin.
- Development CORS uses the configured allowlist, supports PATCH and rejects unlisted preflights. Browser cookie authentication remains same-origin; CORS does not enable cross-origin cookie login.
- PR #35 added staged Expo web export and opt-in Next serving at `/` with SPA fallback, API/asset exclusions, HttpOnly-cookie sessions, PWA manifest/icons and `/legacy`. Build and start require `MODE_EXPO_WEB=1`; export must be staged first.
- CI includes server checks, client contract drift/type/lint/tests, web export and Expo-backed Next delivery checks. Foundation checks exercise server restart persistence.
- PR #35 records browser shell verification and Android/iOS bundle exports. Bundle compilation does not establish physical-device support or installed-PWA behavior.

Evidence and setup: [client README](../../client/README.md), [demo steps](../DEMO.md), and [Expo implementation review](../reviews/pr35-expo-shell.md).

## Remaining acceptance

- [ ] Verify a physical phone on the same Wi-Fi reaches health, signs in and checks in a ticket by typed code using the configured `EXPO_PUBLIC_API_URL`.
- [ ] Verify Android and iOS Expo Go against the actual LAN or hosted API, including session handling and final client flows from #11-#13. Record device/runtime versions and tested commit.
- [ ] Install and verify the Windows Edge PWA unless Nitish explicitly invokes the approved fallback. Manifest/icon availability is not installation evidence.
- [ ] Verify the deployed/demo configuration: staged web export, `MODE_EXPO_WEB=1` for build/start, SPA deep links, intact API routes and same-origin cookie authentication. Check development CORS for PATCH and unlisted-origin rejection in the configured environment.
- [ ] Record the portal URL/video decision at the issue's 22:00 IST checkpoint on 10 October. If a URL is mandatory, select/document a single writable host with persistent database and receipt storage; otherwise use the LAN demo plus video.
- [ ] If hosted, document environment, migrations, health and rollback, then verify member records and receipt bytes survive a restart on that host.
- [ ] Publish release evidence identifying actual verified platforms, tested commit/environment and remaining limitations; reconcile issue #14 before closing it.

## Dependencies and verification boundary

Native auth/CORS/contracts come from #2 and the Expo shell from #10. Final platform smoke depends on #11-#13. Android installable APKs remain deferred; native Windows is outside scope.

This update reconciles source and existing evidence only. No new phone, installed-PWA or hosted persistence test is claimed, and no deployment is performed. Payments and outbox delivery remain simulated. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.
