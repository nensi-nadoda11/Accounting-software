import assert from "node:assert/strict";
import test from "node:test";

import { getApiBaseUrl, resolveApiOrigin } from "../src/lib/api/resolve-api-base.js";

test("resolveApiOrigin uses the configured API origin and trims trailing slashes", () => {
  assert.equal(
    resolveApiOrigin({
      configuredBaseUrl: "https://api.example.com///",
      isDev: false
    }),
    "https://api.example.com"
  );
});

test("resolveApiOrigin falls back to localhost only in development", () => {
  assert.equal(
    resolveApiOrigin({
      configuredBaseUrl: undefined,
      isDev: true
    }),
    "http://localhost:4000"
  );
});

test("resolveApiOrigin rejects a production build without an explicit backend origin", () => {
  assert.throws(
    () =>
      resolveApiOrigin({
        configuredBaseUrl: undefined,
        isDev: false
      }),
    /Missing VITE_API_BASE_URL/
  );
});

test("getApiBaseUrl appends the versioned API prefix", () => {
  assert.equal(
    getApiBaseUrl({
      configuredBaseUrl: "https://api.example.com",
      isDev: false
    }),
    "https://api.example.com/api/v1"
  );
});
