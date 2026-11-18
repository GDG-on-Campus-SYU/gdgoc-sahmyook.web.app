"use client";

import { useState } from "react";
import { getAnalyticsConsent, setAnalyticsConsent, useAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics-consent";

export function AnalyticsPreferences() {
  const consent = useAnalyticsConsent();
  const [saveFailed, setSaveFailed] = useState(false);

  function choose(value: Exclude<AnalyticsConsent, null>) {
    const previous = getAnalyticsConsent();
    const saved = setAnalyticsConsent(value);
    setSaveFailed(!saved);
    if (previous === "granted" && value === "denied") {
      try {
        const labels = window.location.hostname.split(".");
        for (const cookie of document.cookie.split(";")) {
          const name = cookie.trim().split("=")[0];
          if (name !== "_ga" && !name.startsWith("_ga_")) continue;
          const expired = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
          document.cookie = expired;
          for (let i = 0; i < labels.length - 1; i++) document.cookie = `${expired}; Domain=${labels.slice(i).join(".")}`;
        }
      } catch { /* Cookie access can be blocked with browser storage. */ }
      if (saved) window.location.reload();
    }
  }

  return <div id="analytics-settings" className="analytics-preferences">
    <h2>분석 설정</h2>
    <p aria-live="polite">현재 선택: {consent === "granted" ? "동의" : consent === "denied" ? "거부" : "선택하지 않음"}</p>
    {saveFailed && <p role="status">선택을 저장할 수 없어 이 탭에서만 적용했습니다. 새로고침하면 다시 설정해 주세요.</p>}
    <div className="button-row"><button type="button" className="button button-secondary" onClick={() => choose("denied")}>거부</button><button type="button" className="button" onClick={() => choose("granted")}>동의</button></div>
  </div>;
}
