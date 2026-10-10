import assert from "node:assert/strict";
import { test } from "node:test";
import { proxy } from "../src/proxy";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as createMember } from "../src/app/api/members/route";
import { demoPassword } from "../src/lib/db/migrations";
import { DEMO, apiRequest, cookieFrom, withRouteDatabase } from "./helpers";

const devOrigin = "http://localhost:8081";

async function withCorsEnvironment(mode: string, origins: string | undefined, run: () => void | Promise<void>) {
  const saved = { NODE_ENV: process.env.NODE_ENV, MODE_CORS_ORIGINS: process.env.MODE_CORS_ORIGINS };
  Object.assign(process.env, { NODE_ENV: mode });
  if (origins === undefined) delete process.env.MODE_CORS_ORIGINS;
  else process.env.MODE_CORS_ORIGINS = origins;
  try { await run(); }
  finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function preflight(origin = devOrigin, method = "PATCH", headers = "Content-Type, Authorization") {
  return new Request("http://localhost:3000/api/members/member-id/role", {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers },
  });
}

test("development allowlist supports PATCH and bearer headers without credentialed cookies", async () => {
  await withCorsEnvironment("development", ` ${devOrigin}, http://127.0.0.1:8081 `, () => {
    for (const origin of [devOrigin, "http://127.0.0.1:8081"]) {
      const response = proxy(preflight(origin));
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.ok(response.headers.get("access-control-allow-methods")?.includes("PATCH"));
      assert.equal(response.headers.get("access-control-allow-headers"), "Content-Type, Authorization");
      assert.equal(response.headers.get("access-control-allow-credentials"), null);
      assert.match(response.headers.get("vary") ?? "", /Origin/);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const response = proxy(new Request("http://localhost:3000/api/dashboard", { headers: { Origin: devOrigin } }));
    assert.equal(response.headers.get("access-control-allow-origin"), devOrigin);
    assert.equal(response.headers.get("x-middleware-next"), "1", "route still runs");
  });
});

test("CORS rejects unlisted origins, wildcard/null origins, unsupported methods and headers", async () => {
  await withCorsEnvironment("development", `${devOrigin},*,null,https://allowed.example/path`, () => {
    for (const origin of ["https://evil.example", "http://localhost:8082", "http://localhost:8081.evil.example", "null", "https://allowed.example/path"]) {
      const response = proxy(preflight(origin));
      assert.equal(response.status, 403, origin);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.equal(proxy(new Request("http://localhost:3000/api/dashboard", { headers: { Origin: origin } })).headers.get("access-control-allow-origin"), null);
    }
    for (const request of [preflight(devOrigin, "PUT"), preflight(devOrigin, "PATCH", "Authorization, X-Admin")]) {
      assert.equal(proxy(request).status, 403);
      assert.equal(proxy(request).headers.get("access-control-allow-origin"), null);
    }
    const native = proxy(new Request("http://localhost:3000/api/health"));
    assert.equal(native.headers.get("x-middleware-next"), "1");
    assert.equal(native.headers.get("access-control-allow-origin"), null);
  });
});

test("CORS is opt-in in development and disabled outside development even with an allowlist", async () => {
  await withCorsEnvironment("development", undefined, () => {
    assert.equal(proxy(preflight()).status, 403);
  });
  for (const mode of ["production", "test"]) {
    await withCorsEnvironment(mode, devOrigin, () => {
      for (const request of [preflight(), new Request("http://localhost:3000/api/health", { headers: { Origin: devOrigin } })]) {
        const response = proxy(request);
        assert.equal(response.headers.get("access-control-allow-origin"), null);
        assert.equal(response.headers.get("x-middleware-next"), "1");
      }
    });
  }
});

test("allowlisted CORS never grants authentication, cookie CSRF bypass or extra role permissions", async () => {
  await withCorsEnvironment("development", devOrigin, async () => {
    await withRouteDatabase(async () => {
      const credentials = { email: DEMO.organizer, password: demoPassword() };
      assert.equal((await login(apiRequest("/api/auth/login", { body: credentials, origin: devOrigin }))).status, 403,
        "browser login remains same-origin; native login omits Origin");
      const signedIn = await login(apiRequest("/api/auth/login", { body: credentials, origin: null }));
      assert.equal(signedIn.status, 200);
      const cookie = cookieFrom(signedIn);
      const { token } = await signedIn.json();
      const body = { name: "CORS Member", email: "cors@example.com" };
      for (const [auth, expected] of [
        [{}, 401],
        [{ cookie }, 403],
        [{ cookie, authorization: "Bearer invalid" }, 401],
        [{ authorization: `Bearer ${token}` }, 201],
      ] as const) {
        const request = apiRequest("/api/members", { body, origin: devOrigin, ...auth });
        assert.equal(proxy(request).headers.get("access-control-allow-origin"), devOrigin);
        assert.equal((await createMember(request)).status, expected);
      }
      const volunteer = await login(apiRequest("/api/auth/login", { body: { email: DEMO.volunteer, password: demoPassword() }, origin: null }));
      const volunteerToken = (await volunteer.json()).token;
      assert.equal((await createMember(apiRequest("/api/members", {
        body, cookie, origin: devOrigin, authorization: `Bearer ${volunteerToken}`,
      }))).status, 403);
    });
  });
});
