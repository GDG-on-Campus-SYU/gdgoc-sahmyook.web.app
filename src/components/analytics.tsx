"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const initialized = useRef(false);
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return;
    const analyticsWindow = window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void };
    if (!initialized.current) {
      analyticsWindow.dataLayer ||= [];
      analyticsWindow.gtag ||= (...args) => { analyticsWindow.dataLayer!.push(args); };
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
  }, [id, pathname, query]);

  if (!id || !/^G-[A-Z0-9]+$/.test(id) || pathname?.startsWith("/admin")) return null;

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />;
}
