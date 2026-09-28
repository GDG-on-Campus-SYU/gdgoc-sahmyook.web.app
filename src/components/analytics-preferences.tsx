"use client";

import { getAnalyticsConsent, setAnalyticsConsent, useAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics-consent";

export function AnalyticsPreferences() {
  const consent = useAnalyticsConsent();

  function choose(value: Exclude<AnalyticsConsent, null>) {
    const previous = getAnalyticsConsent();
    setAnalyticsConsent(value);
    if (previous === "granted" && value === "denied") {
      for (const cookie of document.cookie.split(";")) {
        const name = cookie.trim().split("=")[0];
        if (name === "_ga" || name.startsWith("_ga_")) document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
      window.location.reload();
    }
  }

  return <div id="analytics-settings" className="analytics-preferences">
    <h2>분석 설정</h2>
    <p aria-live="polite">현재 선택: {consent === "granted" ? "동의" : consent === "denied" ? "거부" : "선택하지 않음"}</p>
    <div className="button-row"><button type="button" className="button button-secondary" onClick={() => choose("denied")}>거부</button><button type="button" className="button" onClick={() => choose("granted")}>동의</button></div>
  </div>;
}
