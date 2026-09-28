"use client";

import { useSyncExternalStore } from "react";

export type AnalyticsConsent = "granted" | "denied" | null;

const consentKey = "gdgoc-analytics-consent";
export const analyticsConsentEvent = "gdgoc-analytics-consent-changed";
let temporaryConsent: AnalyticsConsent = null;

function subscribe(callback: () => void) {
  window.addEventListener(analyticsConsentEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(analyticsConsentEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribe, getAnalyticsConsent, () => null);
}

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = window.localStorage.getItem(consentKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch { return temporaryConsent; }
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  temporaryConsent = value;
  try { window.localStorage.setItem(consentKey, value); } catch { /* Keep this page's choice in memory. */ }
  window.dispatchEvent(new CustomEvent(analyticsConsentEvent, { detail: value }));
}

export function trackAnalyticsEvent(event: string) {
  if (getAnalyticsConsent() !== "granted") return;
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", event);
}
