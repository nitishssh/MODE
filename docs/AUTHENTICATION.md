# JWT authentication in MODE

MODE uses JSON Web Tokens (JWTs) to authenticate signed-in members. A JWT is a string with three dot-separated parts: a header, a payload and a signature. The payload can be decoded by anyone holding the token; the signature proves that MODE issued it and that it has not been changed.

## How a request works

1. A member registers or submits their email and password to `/api/auth/login`. Existing password validation and login throttling still apply.
2. MODE creates a unique session and signs a JWT with HMAC-SHA256 (`HS256`) using its private server key. The token contains member ID, club ID, session ID, issuer, audience, issue time and expiry. Names, emails, passwords and roles are not included.
3. The server stores only the token's SHA-256 hash alongside the session record. The JWT expires after seven days. The database and cookie use the same expiry timestamp.
4. The browser sends the JWT automatically in the `mode_session` HttpOnly cookie. Native Expo stores it in SecureStore and sends `Authorization: Bearer <token>`. Web clients do not save it in localStorage.
5. For authenticated requests, the server checks the signature, fixed algorithm, issuer, audience, claim types and expiry. It then checks the matching database session is present, unexpired and not revoked, and loads the member's current role and permissions.
6. Logout revokes the session immediately. Password reset and role-change revocation continue to apply. A self-service password change keeps the current session and revokes the others. Expired or rejected credentials return `401`; missing permissions return `403`.

JWT verification is implemented using Node's built-in `createHmac` and `timingSafeEqual`. Only MODE's fixed HS256 profile is accepted: unsigned tokens, alternative algorithms, remote key headers and critical header extensions are rejected. No cryptographic key is sent to a client.

Keeping the database lookup is intentional: a valid signature alone cannot authorize a deleted or revoked session. Database availability is still required. There is no refresh-token endpoint or automatic session extension; members sign in again after expiry.

## Local setup

```sh
npm run auth:setup
npm run dev
```

The setup command creates `MODE_JWT_SECRET` in the ignored root `.env.local` with 32 cryptographically random bytes encoded as 64 hex characters. It does not print the secret or overwrite an existing entry. Restart a running dev server after setup. If an existing entry is malformed, correct it before signing in; runtime validation rejects it.

Next.js loads `.env.local` automatically. Direct Node/tsx scripts that issue or verify sessions must also load that file (for example with Node's `--env-file=.env.local`) or receive the environment variable from their launcher. The test commands inject a separate random test key and do not use deployment keys.

## Deployment and migration

- Configure a separate random `MODE_JWT_SECRET` in the hosting provider's secret settings. It must be exactly 64 hex characters; use the same value for every replica of that environment.
- Do not commit `.env.local`, copy the key into client configuration, or use a `NEXT_PUBLIC_`/`EXPO_PUBLIC_` prefix. Missing or malformed configuration prevents token issuance and verification; there is no default key.
- Serve the application over HTTPS. Cookies have `HttpOnly; SameSite=Lax; Path=/` and receive `Secure` for HTTPS requests or a TLS-terminating proxy forwarding `x-forwarded-proto: https`.
- Existing opaque tokens are deliberately rejected after deployment. Users sign in once to obtain a JWT. No database migration is needed because the existing session table stores hashes.
- To rotate the key, update it on all replicas and restart them together. All existing JWTs become invalid and users sign in again. During a mixed-key rollout, requests may fail depending on which replica receives them.
- Keep `MODE_DEMO_NOW` unset on real deployments; the existing optional demo clock also controls session timing.

## Verification

```sh
npm test
npm run typecheck
```

Focused authentication checks:

```sh
node --import ./tests/setup-env.mjs --import tsx --test tests/jwt.test.ts tests/auth.test.ts tests/auth-followups.test.ts tests/db-hardening.test.ts client/tests/session.test.ts
```

The JWT tests cover independent Web Crypto signature verification, minimal claims, exact expiry, altered signatures and payloads, invalid algorithms/issuers/audiences, malformed claims, missing configuration, key rotation, unregistered sessions, revocation and cookie/Bearer route behavior. Existing auth tests cover registration, login, logout, expiry, CSRF and permissions. The foundation HTTP check supplies its own key and tests persistence across server restarts.
