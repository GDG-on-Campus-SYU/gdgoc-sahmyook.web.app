import type { Metadata } from "next";
import { ActivityCollection } from "@/components/public-content";
import { PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "Activities", description: "GDGoC Sahmyook의 스터디, 세션, 네트워킹과 협업 활동을 확인하세요.", alternates: { canonical: "/activities/" } };

const chapterEvents = [
  { date: "2026.08.10", title: "새 운영진 커피챗 및 네트워킹 세션", href: "https://gdg.community.dev/gdg-on-campus-sahmyook-university-seoul-south-korea/" },
  { date: "2026.05.24", title: "Build with AI 2026 : 두유톤", href: "https://gdg.community.dev/events/details/google-gdg-on-campus-sahmyook-university-seoul-south-korea-presents-build-with-ai-2026-duyutongdgoc-sahmyook/" },
  { date: "2026.02.06", title: "2026 GDGoC 연합해커톤: ONE WAVE", href: "https://gdg.community.dev/gdg-on-campus-sahmyook-university-seoul-south-korea/" },
  { date: "2026.02.02", title: "ONE WAVE / 해커톤 특강", href: "https://gdg.community.dev/gdg-on-campus-sahmyook-university-seoul-south-korea/" },
] as const;

export default function ActivitiesPage() {
  return <>
    <PageHero eyebrow="Activities" title="배우고, 시도하고, 함께 남긴 기록" description="스터디부터 기술 세션, 프로젝트, 네트워킹까지. 과정과 사람을 중심으로 활동을 기록합니다." />
    <section className="section container"><ActivityCollection /></section>
    <section className="section surface-section"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">Official chapter records</p><h2>공식 채널에 기록된 행사</h2><p>챕터 행사 페이지에서 확인되는 날짜와 이름만 소개합니다. 상세 기록과 사진은 자료 확인 후 추가합니다.</p></div></div>
      <ul className="chapter-event-list">{chapterEvents.map((event) => <li key={event.title}><time dateTime={event.date.replaceAll(".", "-")}>{event.date}</time><a href={event.href} target="_blank" rel="noopener noreferrer">{event.title} <span aria-hidden="true">↗</span></a></li>)}</ul>
      <p className="chapter-event-source">출처: <a href="https://gdg.community.dev/gdg-on-campus-sahmyook-university-seoul-south-korea/" target="_blank" rel="noopener noreferrer">GDG on Campus Sahmyook 공식 챕터</a></p>
    </div></section>
  </>;
}
