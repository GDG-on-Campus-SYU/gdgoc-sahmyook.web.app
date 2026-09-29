import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@/components/analytics";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import "./fonts/google-sans-v70/google-sans.css";
import "./fonts/noto-sans-kr-v39/noto-sans-kr.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://gdgoc-sahmyook.web.app"),
  title: { default: "GDGOC Sahmyook | Google Developer Groups on Campus", template: "%s | GDGOC Sahmyook" },
  description: "삼육대학교 학생 개발자 커뮤니티 GDGOC Sahmyook입니다. 함께 배우고, 만들고, 경험을 나눕니다.",
  openGraph: {
    title: "GDGOC Sahmyook",
    description: "Connect. Learn. Build. Together.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/brand/gdgoc-symbol-transparent.png", width: 1254, height: 1254, alt: "GDGOC Sahmyook 심벌" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">본문으로 바로가기</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <Suspense fallback={null}><Analytics /></Suspense>
      </body>
    </html>
  );
}
