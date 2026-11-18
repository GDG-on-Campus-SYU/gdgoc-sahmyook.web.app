import assert from "node:assert/strict";
import { test } from "node:test";
import { getAnalyticsConsent, setAnalyticsConsent, subscribeToAnalyticsConsent, trackAnalyticsEvent } from "../src/lib/analytics-consent.ts";

const consentKey = "gdgoc-analytics-consent";
const disableKey = "ga-disable-G-TEST";

function createBrowser(t) {
  const values = new Map();
  const events = [];
  const browser = new EventTarget();
  browser.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  browser.gtag = (...args) => events.push(args);
  globalThis.window = browser;
  const previousId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST";
  t.after(() => {
    delete globalThis.window;
    if (previousId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = previousId;
  });
  return { browser, events };
}

test("analytics events are not sent before consent or after denial", (t) => {
  const { browser, events } = createBrowser(t);

  assert.equal(getAnalyticsConsent(), null);
  trackAnalyticsEvent("page_view");
  assert.equal(setAnalyticsConsent("denied"), true);
  assert.equal(browser[disableKey], true);
  trackAnalyticsEvent("page_view");
  assert.deepEqual(events, []);

  setAnalyticsConsent("granted");
  assert.equal(browser[disableKey], false);
  trackAnalyticsEvent("recruit_apply_click");
  assert.deepEqual(events, [["event", "recruit_apply_click"]]);
});

test("withdrawal overrides a stored grant when storage rejects writes or all access", (t) => {
  const { browser, events } = createBrowser(t);
  setAnalyticsConsent("granted");
  const storage = browser.localStorage;
  const setItem = storage.setItem;
  storage.setItem = () => { throw new Error("Storage full"); };
  assert.equal(setAnalyticsConsent("denied"), false);
  assert.equal(storage.getItem(consentKey), "granted");
  assert.equal(getAnalyticsConsent(), "denied");
  assert.equal(browser[disableKey], true);
  trackAnalyticsEvent("ignored");

  Object.defineProperty(browser, "localStorage", { configurable: true, get() { throw new Error("Access denied"); } });
  assert.equal(setAnalyticsConsent("denied"), false);
  assert.equal(getAnalyticsConsent(), "denied");
  trackAnalyticsEvent("also_ignored");
  assert.deepEqual(events, []);

  storage.setItem = setItem;
  Object.defineProperty(browser, "localStorage", { value: storage });
  assert.equal(setAnalyticsConsent("granted"), true);
  assert.equal(browser[disableKey], false);
  trackAnalyticsEvent("allowed");
  assert.deepEqual(events, [["event", "allowed"]]);
});

test("another tab's withdrawal disables the loaded tag and a later grant enables it", (t) => {
  const { browser, events } = createBrowser(t);
  const observed = [];
  const unsubscribe = subscribeToAnalyticsConsent(() => observed.push(getAnalyticsConsent()));
  function changeInOtherTab(key, value) {
    browser.localStorage.setItem(key, value);
    browser.dispatchEvent(Object.assign(new Event("storage"), { key, storageArea: browser.localStorage }));
  }

  setAnalyticsConsent("granted");
  changeInOtherTab("unrelated", "denied");
  assert.deepEqual(observed, ["granted"]);
  changeInOtherTab(consentKey, "denied");
  assert.equal(browser[disableKey], true);
  trackAnalyticsEvent("ignored");
  changeInOtherTab(consentKey, "granted");
  assert.equal(browser[disableKey], false);
  trackAnalyticsEvent("allowed");
  assert.deepEqual(observed, ["granted", "denied", "granted"]);
  assert.deepEqual(events, [["event", "allowed"]]);
  unsubscribe();
});
