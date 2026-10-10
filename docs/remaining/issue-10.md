# Issue #10: remaining work

Issue: https://github.com/nitishssh/MODE/issues/10

Status: In progress. The Expo shell is merged; physical-device and installed-PWA acceptance remain open. This checklist does not close issue #10.

Owners: @Azmanshaikh, @nitishssh.

Snapshot: 10 October 2026, main `9b115f74b46f4f58a030120f5de8af1d7c7d8553`. Recheck against the linked issue when work resumes.

## Delivered in PR #35

- SDK 57 Expo Router package in `client/`, with React Native and react-native-web.
- Thinking Ledger light/dark tokens, Literata, Anek Latin/Devanagari and JetBrains Mono.
- Role-aware navigation, login/logout and session-expiry handling. Native tokens use SecureStore; web uses same-origin HttpOnly cookies without browser token persistence.
- Generated client contracts, drift detection and client typecheck/lint/test/export checks in CI.
- Loading, empty, unauthorized and row-error handling with cached timestamps in the delivered shell screens.
- Opt-in same-origin Expo web serving, SPA fallback, PWA manifest/icons and the retained `/legacy` workspace.

PR #35 records browser checks for admin/member authentication, task persistence, permissions, responsive navigation and logout; Android/iOS bundle exports are compilation evidence, not physical-device execution. See [the implementation review](../reviews/pr35-expo-shell.md) and [demo steps](../DEMO.md).

## Remaining acceptance

- [ ] Record physical Android and iOS Expo Go sign-in, logout, session revocation and permission-driven navigation using synthetic accounts.
- [ ] Verify Windows Edge PWA installation and launch, navigation, authentication and logout from the installed app.
- [ ] Coordinate #14 for physical-phone LAN/API reachability and record the actual environment and release commit.
- [ ] Verify required loading, empty, unauthorized and retry states on native and installed web; retain outstanding failures explicitly.
- [ ] Coordinate full business screens and end-to-end journeys with #11-#13; do not treat the shell as their completion.
- [ ] Reconcile all issue #10 acceptance criteria with recorded evidence before closing that issue.

## Verification boundary

This update reconciles documentation with merged source and PR #35's recorded evidence. It performs no new device or installed-PWA testing. Payments and outbox delivery remain simulated. The issue's final acceptance target is 11 October 2026, 10:00 AM IST.
