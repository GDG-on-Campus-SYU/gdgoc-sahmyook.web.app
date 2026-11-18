"use client";

import { useSyncExternalStore } from "react";

export type AnalyticsConsent = "granted" | "denied" | null;

const consentKey = "gdgoc-analytics-consent";
export const analyticsConsentEvent = "gdgoc-analytics-consent-changed";
let temporaryConsent: AnalyticsConsent = null;

export function subscribeToAnalyticsConsent(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage || (event.key !== consentKey && event.key !== null)) return;
    temporaryConsent = null;
    applyAnalyticsOptOut(getAnalyticsConsent());
    callback();
  }
  window.addEventListener(analyticsConsentEvent, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(analyticsConsentEvent, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribeToAnalyticsConsent, getAnalyticsConsent, () => null);
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (temporaryConsent !== null) return temporaryConsent;
  try {
    const value = window.localStorage.getItem(consentKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return null; }
}

function applyAnalyticsOptOut(value: AnalyticsConsent) {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (id) Reflect.set(window, `ga-disable-${id}`, value !== "granted");
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  applyAnalyticsOptOut(value);
  try {
    window.localStorage.setItem(consentKey, value);
    temporaryConsent = null;
  } catch { temporaryConsent = value; }
  window.dispatchEvent(new CustomEvent(analyticsConsentEvent, { detail: value }));
  return temporaryConsent === null;
}

export function trackAnalyticsEvent(event: string) {
  if (getAnalyticsConsent() !== "granted") return;
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", event);
}
