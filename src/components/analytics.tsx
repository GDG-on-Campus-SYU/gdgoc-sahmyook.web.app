"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAnalyticsConsent, setAnalyticsConsent, useAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics-consent";

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const initialized = useRef(false);
  const previousUrl = useRef<string | null>(null);
  const consent = useAnalyticsConsent();
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (consent !== "granted" || getAnalyticsConsent() !== "granted") {
      previousUrl.current = null;
      return;
    }
    if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return;
    const analyticsWindow = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    if (!initialized.current) {
      analyticsWindow.dataLayer ||= [];
      analyticsWindow.gtag ||= function gtag() {
        // Google tag expects the Arguments object, not a rest-parameter array.
        // eslint-disable-next-line prefer-rest-params
        analyticsWindow.dataLayer!.push(arguments);
      };
      analyticsWindow.gtag("js", new Date());
      analyticsWindow.gtag("config", id, { send_page_view: false });
      initialized.current = true;
    }
    const currentUrl = window.location.href;
    if (previousUrl.current === currentUrl) return;
    analyticsWindow.gtag?.("event", "page_view", {
      page_location: currentUrl,
      page_referrer: previousUrl.current || document.referrer,
    });
    previousUrl.current = currentUrl;
  }, [consent, id, pathname, query]);

  if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return null;

  function choose(value: Exclude<AnalyticsConsent, null>) {
    setSaveFailed(!setAnalyticsConsent(value));
  }

  return <>
    {consent === null && <div className="analytics-consent" role="region" aria-label="방문 분석 설정">
      <div><strong>방문 분석을 허용하시겠어요?</strong><p>사이트 개선용 Google Analytics는 동의 후에만 실행됩니다. <Link href="/privacy/">자세히 보기</Link></p></div>
      <div className="analytics-consent-actions"><button type="button" onClick={() => choose("denied")}>거부</button><button type="button" className="button" onClick={() => choose("granted")}>동의</button></div>
    </div>}
    {saveFailed && consent !== null && <div className="analytics-consent"><p role="status">선택을 저장할 수 없어 이 탭에서만 적용했습니다. 새로고침하면 다시 설정해 주세요.</p><div className="analytics-consent-actions"><button type="button" onClick={() => setSaveFailed(false)}>확인</button></div></div>}
    {consent === "granted" && <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />}
  </>;
}
