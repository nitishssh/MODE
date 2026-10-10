# Issue #10: remaining work

Issue: https://github.com/nitishssh/MODE/issues/10

Status: In progress. This is a draft handoff checklist, not an implementation or acceptance sign-off.

Owners: @Azmanshaikh, @nitishssh.

Snapshot: 10 October 2026, main `771ec78d7ecec9e5c0d597951877e5968ead7e84`. Recheck this snapshot when implementation resumes; the linked issue remains the acceptance source of truth.

## Existing work

PRs #21 and #25 delivered the responsive authenticated Next.js workspace, role navigation and PWA metadata. The client/ Expo package is absent at the checked main commit.

## Dependencies

#2 and #3 provide backend identity/contracts. Coordinate #14; #11–#13 extend this shell.

## Completion checklist

- [ ] Add the client/ Expo Router package with React Native and react-native-web; verify the issue's SDK target against the supported runtime before pinning dependencies.
- [ ] Port the Thinking Ledger / Ruled Paper theme, typography and layout tokens into client/src/constants/theme.ts.
- [ ] Implement role-aware navigation, login/logout and 401 handling. Store native bearer tokens in expo-secure-store; web uses same-origin HttpOnly cookies without browser token persistence.
- [ ] Generate client contracts from src/lib/contracts.ts, add sync-contracts and client typecheck/lint, and fail CI on drift.
- [ ] Implement loading, empty, unauthorized and row-error states with cached as-of timestamps.
- [ ] Coordinate Expo web export and same-origin serving with #14; retain the current web page until the export works.
- [ ] Record native and web sign-in, logout, session revocation and role navigation evidence.

## Evidence required before completion

Link the implementation commits and passing checks; record reproducible demo steps and any required physical-device evidence. Keep unchecked items visible and do not mark the issue complete because this checklist is merged. Payments and outbox delivery remain simulated under the MVP scope. Final acceptance target in the issue: 11 October 2026, 10:00 AM IST.
