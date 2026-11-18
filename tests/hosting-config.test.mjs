import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Hosting rejects absent settings and mismatched projects before deployment", () => {
  const config = {
    NEXT_PUBLIC_FIREBASE_API_KEY: "test-key", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-site.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-site", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
    NEXT_PUBLIC_FIREBASE_APP_ID: "test-app", NEXT_PUBLIC_SITE_URL: "https://demo-site.web.app",
    FIREBASE_PROJECT_ID: "demo-site",
  };
  const check = (env) => spawnSync(process.execPath, ["scripts/check-hosting-config.mjs"], { env, encoding: "utf8" });
  assert.equal(check(config).status, 0);
  const missing = check({ ...config, NEXT_PUBLIC_FIREBASE_API_KEY: "" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Missing Hosting configuration: NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.equal(check({ ...config, FIREBASE_PROJECT_ID: "other-project" }).status, 1);
  assert.equal(check({ ...config, NEXT_PUBLIC_SITE_URL: "https://demo-site.web.app/other/" }).status, 1);
});
