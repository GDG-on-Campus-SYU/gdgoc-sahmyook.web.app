import assert from "node:assert/strict";
import { test } from "node:test";
import { getAnalyticsConsent, setAnalyticsConsent, trackAnalyticsEvent } from "../src/lib/analytics-consent.ts";

test("analytics events are not sent before consent or after denial", () => {
  const values = new Map();
  const events = [];
  const browser = new EventTarget();
  browser.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  browser.gtag = (...args) => events.push(args);
  globalThis.window = browser;

  assert.equal(getAnalyticsConsent(), null);
  trackAnalyticsEvent("page_view");
  setAnalyticsConsent("denied");
  trackAnalyticsEvent("page_view");
  assert.deepEqual(events, []);

  setAnalyticsConsent("granted");
  trackAnalyticsEvent("recruit_apply_click");
  assert.deepEqual(events, [["event", "recruit_apply_click"]]);
});
