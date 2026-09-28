"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [ready, setReady] = useState(false);
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || pathname?.startsWith("/admin")) return;
    const currentUrl = window.location.href;
    if (previousUrl.current === currentUrl) return;
    (window as Window & { gtag?: (...args: unknown[]) => void }).gtag?.("event", "page_view", {
      page_location: currentUrl,
      page_referrer: previousUrl.current || document.referrer,
    });
    previousUrl.current = currentUrl;
  }, [pathname, query, ready]);

  if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return null;

  return (
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onReady={() => {
      const analyticsWindow = window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void };
      analyticsWindow.dataLayer ||= [];
      analyticsWindow.gtag = (...args) => { analyticsWindow.dataLayer!.push(args); };
      analyticsWindow.gtag("js", new Date());
      analyticsWindow.gtag("config", id, { send_page_view: false });
      setReady(true);
    }} />
  );
}
