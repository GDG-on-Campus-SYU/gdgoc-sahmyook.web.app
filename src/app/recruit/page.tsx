import type { Metadata } from "next";
import { RecruitmentDetails, RecruitmentPanel } from "@/components/public-content";

export const metadata: Metadata = { title: "Recruit", description: "GDGoC Sahmyook 모집 일정, 역할과 지원 방법을 확인하세요." };

const qualities = ["함께 활동하려는 사람", "다른 사람의 생각을 존중하는 사람", "배우고 공유하려는 사람", "맡은 활동에 책임을 다하는 사람"];

export default function RecruitPage() {
  return (
    <>
      <section className="recruit-hero container"><RecruitmentPanel /></section>
      <section className="section container editorial-grid">
        <p className="eyebrow">Who we are looking for</p>
        <div><h2>잘하는 사람보다,<br />함께 성장할 사람.</h2><ul className="quality-list">{qualities.map((quality) => <li key={quality}>{quality}</li>)}</ul></div>
      </section>
      <section className="section surface-section">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow">Choose your role</p><h2>어떤 방식으로 함께할까요?</h2></div></div>
          <div className="role-cards">
            <article><span>MEMBER</span><h3>배우고 만들며<br />활동에 참여합니다.</h3><p>스터디, 세션, 프로젝트와 커뮤니티 프로그램에 참여하는 역할입니다. 상세 활동 범위는 기수별 모집 공고에서 안내합니다.</p></article>
            <article><span>TEAM MEMBER</span><h3>활동을 설계하고<br />운영을 함께합니다.</h3><p>커뮤니티 프로그램과 콘텐츠 운영에 참여하는 역할입니다. 모집 여부와 담당 영역은 기수별 공고에서 안내합니다.</p></article>
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading"><div><p className="eyebrow">Recruitment process</p><h2>지원부터 합류까지</h2></div></div>
        <RecruitmentDetails />
      </section>
    </>
  );
}
