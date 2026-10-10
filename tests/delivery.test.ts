import assert from "node:assert/strict";
import { test } from "node:test";
import { apiUrl, ApiUrlConfigurationError, resolveExpoApiUrl } from "../src/lib/api-url";
import { corsHeaders, isAllowedCorsOrigin, parseCorsOrigins } from "../src/lib/cors";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

test("CORS only accepts explicitly configured, valid origins", () => {
  const configured = "http://192.168.1.50:8081, https://mode.example, *, invalid";
  assert.deepEqual([...parseCorsOrigins(configured)].sort(), ["http://192.168.1.50:8081", "https://mode.example"]);
  assert.equal(isAllowedCorsOrigin("https://mode.example", configured), true);
  assert.equal(isAllowedCorsOrigin("https://other.example", configured), false);
  assert.equal(isAllowedCorsOrigin(null, configured), false);
  assert.equal(isAllowedCorsOrigin("https://mode.example", ""), false);
  const headers = corsHeaders("https://mode.example");
  assert.equal(headers["Access-Control-Allow-Origin"], "https://mode.example");
  assert.match(String(headers["Access-Control-Allow-Methods"]), /PATCH/);
  assert.equal(headers["Access-Control-Allow-Credentials"], "true");
});

test("API proxy remains CORS-disabled outside development", () => {
  const priorOrigins = process.env.MODE_CORS_ORIGINS;
  process.env.MODE_CORS_ORIGINS = "https://mobile.example";
  try {
    const allowed = proxy(new NextRequest("http://localhost:3000/api/tasks", {
      method: "OPTIONS",
      headers: { Origin: "https://mobile.example" },
    }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), null);

    const blocked = proxy(new NextRequest("http://localhost:3000/api/tasks", {
      method: "OPTIONS",
      headers: { Origin: "https://unlisted.example" },
    }));
    assert.equal(blocked.status, 200);
    assert.equal(blocked.headers.get("Access-Control-Allow-Origin"), null);
  } finally {
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
