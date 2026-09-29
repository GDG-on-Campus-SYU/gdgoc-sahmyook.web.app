import type { Metadata } from "next";
import { AnalyticsPreferences } from "@/components/analytics-preferences";
import { PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "방문 분석 안내", description: "GDGOC Sahmyook 웹사이트의 방문 분석과 선택 방법을 안내합니다.", alternates: { canonical: "/privacy/" } };

export default function PrivacyPage() {
  return <>
    <PageHero eyebrow="Privacy" title="방문 분석 안내" description="방문 분석은 선택 사항이며, 동의하지 않아도 사이트의 콘텐츠를 이용할 수 있습니다." />
    <section className="section container privacy-content">
      <h2>Google Analytics 사용</h2>
      <p>GDGOC Sahmyook은 페이지 방문과 지원·프로젝트 링크 클릭을 파악하여 사이트를 개선하기 위해 Google Analytics 4를 사용합니다. 동의 전에는 분석 스크립트를 불러오지 않으며, 관리자 페이지의 조회 이벤트는 전송하지 않습니다.</p>
      <p>동의하면 Google이 방문한 페이지, 대략적인 위치, 브라우저·기기 정보, 쿠키 기반 식별자 등을 수집·처리할 수 있습니다. 자세한 내용은 <a href="https://support.google.com/analytics/answer/11593727?hl=ko" target="_blank" rel="noopener noreferrer">Google Analytics 데이터 수집 안내</a>에서 확인할 수 있습니다.</p>
      <p>선택은 아래에서 변경할 수 있습니다. 이미 동의한 뒤 거부하면 이 사이트의 분석 쿠키를 지우고 페이지를 새로고침하여 이후 분석 스크립트 로드를 중단합니다. 문의: <a href="mailto:dscsahmyook@gmail.com">dscsahmyook@gmail.com</a></p>
      <AnalyticsPreferences />
    </section>
  </>;
}
