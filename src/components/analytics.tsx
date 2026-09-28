"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { setAnalyticsConsent, useAnalyticsConsent } from "@/lib/analytics-consent";

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const initialized = useRef(false);
  const previousUrl = useRef<string | null>(null);
  const consent = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== "granted" || !id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return;
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

  return <>
    {consent === null && <div className="analytics-consent" role="region" aria-label="방문 분석 설정">
      <div><strong>방문 분석을 허용하시겠어요?</strong><p>사이트 개선용 Google Analytics는 동의 후에만 실행됩니다. <Link href="/privacy/">자세히 보기</Link></p></div>
      <div className="analytics-consent-actions"><button type="button" onClick={() => setAnalyticsConsent("denied")}>거부</button><button type="button" className="button" onClick={() => setAnalyticsConsent("granted")}>동의</button></div>
    </div>}
    {consent === "granted" && <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />}
  </>;
}
