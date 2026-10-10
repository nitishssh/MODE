import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, ApiUrlConfigurationError, resolveExpoApiUrl } from "../src/lib/api-url";
import { isAllowedCorsOrigin, parseCorsOrigins } from "../src/lib/cors";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
import { localDateTimeValue } from "../src/lib/local-datetime";

test("editing a local deadline preserves its instant in non-UTC time zones", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["Asia/Kolkata", "America/New_York", "UTC"]) {
      process.env.TZ = zone;
      const instant = "2026-10-10T08:30:00.000Z";
      assert.equal(new Date(localDateTimeValue(instant)).toISOString(), instant);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test("CORS only accepts explicitly configured, valid origins", () => {
  const configured = "http://192.168.1.50:8081, https://mode.example, *, invalid";
  assert.deepEqual([...parseCorsOrigins(configured)].sort(), ["http://192.168.1.50:8081", "https://mode.example"]);
  assert.equal(isAllowedCorsOrigin("https://mode.example", configured), true);
  assert.equal(isAllowedCorsOrigin("https://other.example", configured), false);
  assert.equal(isAllowedCorsOrigin(null, configured), false);
  assert.equal(isAllowedCorsOrigin("https://mode.example", ""), false);
});

test("API proxy handles allowed preflight and rejects unlisted browser origins", () => {
  for (const host of ["localhost:3000", "192.168.1.50:3000"]) {
    const response = proxy(new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST", headers: { Host: host, Origin: "http://" + host },
    }));
    assert.equal(response.status, 200, "same-origin POST must reach its handler");
  }
  const priorOrigins = process.env.MODE_CORS_ORIGINS;
  const priorMode = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development" });
  process.env.MODE_CORS_ORIGINS = "https://mobile.example";
  try {
    const allowed = proxy(new NextRequest("http://localhost:3000/api/tasks", {
      method: "OPTIONS",
      headers: { Origin: "https://mobile.example", "Access-Control-Request-Method": "PATCH" },
    }));
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://mobile.example");
    assert.match(allowed.headers.get("Access-Control-Allow-Methods") ?? "", /PATCH/);

    const blocked = proxy(new NextRequest("http://localhost:3000/api/tasks", {
      method: "OPTIONS",
      headers: { Origin: "https://unlisted.example", "Access-Control-Request-Method": "PATCH" },
    }));
    assert.equal(blocked.status, 403);
  } finally {
    if (priorMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: priorMode });
    if (priorOrigins === undefined) delete process.env.MODE_CORS_ORIGINS;
    else process.env.MODE_CORS_ORIGINS = priorOrigins;
  }
});

test("Expo API URL resolution is absolute and does not accept paths or secrets", () => {
  assert.equal(resolveExpoApiUrl(undefined), "http://127.0.0.1:3000");
  assert.equal(resolveExpoApiUrl(" https://demo.example "), "https://demo.example");
  assert.equal(apiUrl("/api/health", "https://demo.example"), "https://demo.example/api/health");
  for (const value of ["demo.example", "ftp://demo.example", "https://demo.example/api", "https://demo.example/?token=secret"]) {
    assert.throws(() => resolveExpoApiUrl(value), ApiUrlConfigurationError);
  }
  assert.throws(() => apiUrl("api/health", "https://demo.example"), ApiUrlConfigurationError);
});
