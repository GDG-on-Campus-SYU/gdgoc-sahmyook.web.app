import type { Metadata } from "next";
import { Analytics } from "@/components/analytics";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://gdgoc-sahmyook.web.app"),
  title: { default: "GDGoC Sahmyook | Google Developer Groups on Campus", template: "%s | GDGoC Sahmyook" },
  description: "삼육대학교 학생 개발자 커뮤니티 GDGoC Sahmyook입니다. 함께 배우고, 만들고, 경험을 나눕니다.",
  openGraph: {
    title: "GDGoC Sahmyook",
    description: "Connect. Learn. Build. Together.",
    type: "website",
    locale: "ko_KR",
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
        <Analytics />
      </body>
    </html>
  );
}
