import assert from "node:assert/strict";
import { createHmac, randomBytes, webcrypto } from "node:crypto";
import { test } from "node:test";
import { GET as me } from "../src/app/api/auth/me/route";
import { POST as login } from "../src/app/api/auth/login/route";
import { JWT_AUDIENCE, JWT_ISSUER, SESSION_TTL_MS, signSessionJwt, verifySessionJwt } from "../src/lib/auth/jwt";
import { readSessionToken } from "../src/lib/auth/session";
import { demoPassword } from "../src/lib/db/migrations";
import { DEMO, FIXED_NOW, apiRequest, cookieFrom, memoryDatabase, withRouteDatabase } from "./helpers";

const seconds = Math.floor(FIXED_NOW.getTime() / 1000);
const baseClaims = { iss: JWT_ISSUER, aud: JWT_AUDIENCE, sub: "member-1", jti: "session-1", clubId: "club-1", iat: seconds, exp: seconds + SESSION_TTL_MS / 1000 };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

// Independent issuer used to exercise malformed-but-correctly-signed inputs.
function mint(payload: unknown = baseClaims, header: unknown = { alg: "HS256", typ: "JWT" }): string {
  const content = `${encode(header)}.${encode(payload)}`;
  return `${content}.${createHmac("sha256", Buffer.from(process.env.MODE_JWT_SECRET!, "hex")).update(content).digest("base64url")}`;
}

test("issued JWT interoperates with Web Crypto and includes only session identity and timing", async () => {
  const now = new Date(FIXED_NOW.getTime() + 999);
  const token = signSessionJwt("member-1", "club-1", "session-1", now);
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "HS256", typ: "JWT" });
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), baseClaims);
  const key = await webcrypto.subtle.importKey("raw", Buffer.from(process.env.MODE_JWT_SECRET!, "hex"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  assert.equal(await webcrypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), Buffer.from(`${header}.${payload}`)), true);
  assert.equal(verifySessionJwt(token, now)?.sub, "member-1");
  assert.ok(verifySessionJwt(token, new Date(baseClaims.exp * 1000 - 1)));
  assert.equal(verifySessionJwt(token, new Date(baseClaims.exp * 1000)), null);
});

test("signature tampering, unsigned JWTs, malformed encodings and oversized inputs fail closed", () => {
  const token = mint();
  const [header, payload, signature] = token.split(".");
  for (const bad of [
    `${header}.${encode({ ...baseClaims, sub: "admin" })}.${signature}`,
    `${encode({ alg: "none", typ: "JWT" })}.${payload}.`,
    `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`,
    `${header}.${payload}.${signature}=`, `${token}.extra`, "a".repeat(43),
    "a.b.c", "a".repeat(2049), "", mint(null), mint([]), mint("payload"),
  ]) assert.equal(verifySessionJwt(bad, FIXED_NOW), null);
});

test("valid signatures cannot bypass algorithm, issuer, audience or claim validation", () => {
  for (const header of [
    { alg: "none", typ: "JWT" }, { alg: "HS512", typ: "JWT" },
    { alg: "RS256", typ: "JWT" }, { alg: "HS256" },
    { alg: "HS256", typ: "JWT", crit: ["b64"], b64: false },
    { alg: "HS256", typ: "JWT", jku: "https://attacker.invalid/keys" },
  ]) assert.equal(verifySessionJwt(mint(baseClaims, header), FIXED_NOW), null);
  for (const changes of [
    { iss: "other" }, { aud: "other" }, { aud: [JWT_AUDIENCE] },
    { sub: "" }, { sub: 1 }, { jti: "" }, { clubId: "" },
    { exp: undefined }, { iat: undefined }, { exp: String(baseClaims.exp) },
    { iat: seconds + 1, exp: baseClaims.exp + 1 },
    { exp: baseClaims.exp + 1 }, { exp: seconds },
    { nbf: seconds + 1 }, { nbf: "tomorrow" }, { iat: seconds + 0.5 },
  ]) assert.equal(verifySessionJwt(mint({ ...baseClaims, ...changes }), FIXED_NOW), null, JSON.stringify(changes));
  assert.ok(verifySessionJwt(mint({ ...baseClaims, nbf: seconds }), FIXED_NOW));
});

test("missing or malformed signing configuration fails in all environments; rotating keys invalidates JWTs", () => {
  const env = process.env as Record<string, string | undefined>;
  const original = process.env.MODE_JWT_SECRET;
  const environment = process.env.NODE_ENV;
  const token = mint();
  try {
    for (const environmentName of ["development", "production", "test"]) {
      env.NODE_ENV = environmentName;
      for (const secret of [undefined, "", "short", "g".repeat(64), "a".repeat(63)]) {
        if (secret === undefined) delete process.env.MODE_JWT_SECRET;
        else process.env.MODE_JWT_SECRET = secret;
        assert.throws(() => signSessionJwt("m", "c", "s", FIXED_NOW), /MODE_JWT_SECRET/);
        assert.throws(() => verifySessionJwt(token, FIXED_NOW), /MODE_JWT_SECRET/);
      }
    }
    process.env.MODE_JWT_SECRET = randomBytes(32).toString("hex");
    assert.equal(verifySessionJwt(token, FIXED_NOW), null);
  } finally {
    if (original === undefined) delete process.env.MODE_JWT_SECRET;
    else process.env.MODE_JWT_SECRET = original;
    if (environment === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = environment;
  }
});

test("JWTs need a live matching session, remain unique in the same second, and revoke immediately", () => {
  const { db, clock } = memoryDatabase();
  try {
    const first = db.login({ email: DEMO.organizer, password: demoPassword() });
    const second = db.login({ email: DEMO.organizer, password: demoPassword() });
    assert.notEqual(first.token, second.token);
    const claims = verifySessionJwt(first.token, clock.now)!;
    assert.equal(claims.sub, first.member.id);
    assert.equal(claims.jti, db.getActor(first.token)!.sessionId);
    assert.equal(first.expiresAt, new Date(claims.exp * 1000).toISOString());
    const unknownSession = signSessionJwt(claims.sub, claims.clubId, "unregistered-session", clock.now);
    assert.ok(verifySessionJwt(unknownSession, clock.now));
    assert.equal(db.getActor(unknownSession), null);
    db.logout(first.token);
    assert.equal(db.getActor(first.token), null);
    assert.ok(db.getActor(second.token));
    clock.now = new Date(claims.exp * 1000);
    assert.equal(db.getActor(second.token), null);
  } finally { db.close(); }
});

test("login serves a JWT through both transports; tampering returns 401 without cookie fallback", async () => {
  await withRouteDatabase(async () => {
    const response = await login(apiRequest("/api/auth/login", { body: { email: DEMO.organizer, password: demoPassword() } }));
    assert.equal(response.status, 200);
    const { token } = await response.json();
    const cookie = cookieFrom(response);
    assert.equal(cookie, `mode_session=${token}`);
    assert.ok(verifySessionJwt(token, FIXED_NOW));
    const [header, payload, signature] = token.split(".");
    const bad = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    assert.equal((await me(apiRequest("/api/auth/me", { cookie }))).status, 200);
    assert.equal((await me(apiRequest("/api/auth/me", { authorization: `Bearer ${token}` }))).status, 200);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie: `mode_session=${bad}` }))).status, 401);
    assert.equal((await me(apiRequest("/api/auth/me", { cookie, authorization: `Bearer ${bad}` }))).status, 401);
    assert.equal(readSessionToken(apiRequest("/api/auth/me", { cookie, authorization: `Bearer ${token}, Bearer ${token}` })), null);
  });
});
