# MODE Expo client

SDK 57, Expo Router and React Native Web. Run commands from this directory unless noted.

```sh
npm ci
npm run typecheck
npm run lint
npm test
```

For a physical phone, copy `.env.example` to `.env`, set `EXPO_PUBLIC_API_URL` to the backend's reachable LAN origin, start the backend with `npm run dev:lan` from the repository root, then run `npm start` here and scan with a compatible Expo Go. Native sessions use SecureStore and omit cookies. Reinstall/sign-out behavior must be verified on the actual target phone; the native export check only compiles the bundles.

For authenticated web testing, use the exported client on the Next origin, following [DEMO.md](../docs/DEMO.md#expo-shell-and-same-origin-web). `npm run web` provides a Metro UI preview; its separate port cannot perform the server's same-origin cookie login. The web build ignores `EXPO_PUBLIC_API_URL` and never persists tokens.

Navigation appears on the left from 900px and in a horizontally scrollable bar on smaller screens. Treasury visibility uses `ledger:read` from the session. Screens remount between identities, and requests from an old session cannot expose data in a new one. Returning to the app revalidates server permissions.

Run `npm run sync:contracts` at the repository root after changing server contracts. CI checks drift, client types/lint/tests, web export, and Next's same-origin delivery. Journey screens now cover registration, membership dues/reminders and QR passes, event creation/booking/holds/typed and native camera scanning, product creation/orders/fulfilment, public announcements and simulated outbox, task creation/assignment/progress, receipt claims and finance/source/CSV views. See the [client journey walkthrough](../docs/DEMO.md#interactive-client-journey). Physical camera, picker, haptics, sharing and installed-PWA acceptance remain unverified.
