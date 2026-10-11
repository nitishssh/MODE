# MODE page routing

The integration based on main `4423243` preserves Azman's landing and login design. It separates the public website from the authenticated workspace.

| URL | Expo web delivery (`MODE_EXPO_WEB=1`) | Standard Next delivery |
| --- | --- | --- |
| `/` | Public Next landing, including for signed-in visitors | Same public landing |
| `/login` | Next sign-in, cookie session and validated return URL | Same sign-in; maps valid app destinations to available workspace sections |
| `/dashboard` | Authenticated Expo overview | Existing Next workspace |
| `/register`, `/booking`, `/archive` | Public Expo pages | Not served; HTTP 404 |
| `/pass`, `/events`, `/door`, `/shop`, `/announcements`, `/expenses`, `/tasks`, `/treasury` | Authenticated Expo pages with permission guards | Not served directly; HTTP 404 |
| `/legacy` | Existing Next workspace | Existing Next workspace |
| An undeclared page | Next HTTP 404; Expo also has a client not-found screen | Next HTTP 404 |

`shared/page-routes.ts` is the allowlist used by the Expo navigation and Next rewrites. Only implemented Expo pages are rewritten, so an unknown page cannot silently receive the app HTML. API routes, guest-ticket token routes, static assets, the landing and Next login retain their own handling. Missing assets return 404. The PWA starts at `/dashboard`.

## Sign-in and return URLs

`shared/return-target.ts` accepts only declared local page paths and bounded, supported query parameters. It rejects external destinations, encoded path aliases, repeated query keys, credentials in query state, control characters and login/register loops. Query text such as `C++`, literal `%20`, ampersands, Unicode and backslashes is safely encoded once; path backslashes remain forbidden.

Next sign-in checks an existing session before showing an active form. Successful sign-in checks the destination's required permission and uses a full document navigation so Next can hand app URLs to Expo. The browser uses the HttpOnly session cookie; the returned API token is not stored in web local storage. A forbidden return destination shows an access-denied state with a workspace link.

Expo's protected layout keeps the validated requested page and query when a session expires. Login and registration preserve that return state. The staged HTML carries a `mode-host=next` marker: internal Expo sign-in links then open the Next login document. Native and standalone Expo development keep their existing Expo login screen. An internal Expo navigation to `/` opens the Next landing when hosted, while native startup opens `/dashboard`.

In the Expo profile, copied task/claim/ledger URLs preserve filter, cursor and event state through login. A cursor belongs to its original session; after a new login the list may reject it and offer a restart from the first page with the filters retained. In standard Next, sign-in maps supported features to `/dashboard?section=tasks` (or the matching existing section), and unsupported screens to the overview. Standard Next still uses the legacy whole-collection UI; it does not apply Expo pagination/filter query parameters. Enable Expo delivery for the paginated workflows.

## Old bookmarks and workspace history

Recognized `/#tasks`, `/#events`, `/#announcements`, `/#merchandise`, `/#expenses`, `/#my-expenses`, `/#treasury` and `/#overview` bookmarks move to the matching app page in the Expo profile. `/#members` opens `/legacy#members` until the Expo member directory exists. In standard Next they become `/dashboard?section=...`.

The landing's `#top`, `#main-content`, `#workflow`, `#club-tools`, `#plans` and `#contact` anchors keep their original behavior. The existing workspace accepts section query parameters and old section hashes; sidebar and overview shortcuts update the section URL. Refresh and Back/Forward read the same URL. An unknown section shows an overview fallback notice. The section is retained when an anonymous workspace visit goes through login.

## Verification

The client suite covers the installed Expo query parser, nested login/register returns, tab query history, route permissions, declared file routes, legacy aliases and mode-aware Next return targets. `npm run test:expo-web` runs `scripts/check-expo-web.mjs` through the existing TypeScript loader so the shared route registry also works on supported Node 22 releases. It checks every declared Expo page through the production Next host, landing and login ownership, HTTP 404 exclusions, PWA assets, cookie authentication and v2 paging. Its database and receipt paths are isolated from ambient deployment settings.

HTTP checks do not verify interactive browser behavior. Before merge, run the production builds and delivery checks, then exercise sign-in, registration, deep-link refresh, role-denied pages, and browser Back/Forward in a real browser. The standard Next fallback does not have pagination parity with Expo.
