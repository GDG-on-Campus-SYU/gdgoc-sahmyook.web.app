import type { Metadata } from "next";
import Link from "next/link";
import { ActivityCollection, ProjectCollection, RecruitmentPanel, RecruitmentProvider } from "@/components/public-content";
import { SectionHeading } from "@/components/site-shell";

const values = [
  ["Learn", "함께 질문하고 깊이 배웁니다.", "blue"],
  ["Build", "아이디어를 실제 서비스로 만듭니다.", "red"],
  ["Share", "배운 것과 경험을 아낌없이 나눕니다.", "green"],
  ["Connect", "학생과 개발자 커뮤니티를 연결합니다.", "yellow"],
] as const;

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">GDG on Campus · Sahmyook</p>
          <h1>함께 배우고,<br /><span>함께 만듭니다.</span></h1>
          <p className="hero-lede">기술을 배우고, 프로젝트를 만들고, 경험을 나누는 삼육대학교 학생 개발자 커뮤니티입니다.</p>
          <div className="button-row">
            <Link className="button" href="/activities/">활동 보기 <span aria-hidden="true">→</span></Link>
            <Link className="button button-secondary" href="/recruit/">모집 안내 <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="hero-map" aria-hidden="true">
          <svg viewBox="0 0 540 300" role="presentation">
            <path className="path-blue" d="M85 200 C180 200 148 78 254 78" />
            <path className="path-red" d="M254 78 C340 78 320 155 450 155" />
            <path className="path-yellow" d="M85 200 C155 200 175 245 351 245" />
            <path className="path-green" d="M351 245 C429 245 395 155 450 155" />
            <circle className="path-yellow" cx="85" cy="200" r="11" />
            <circle className="path-blue" cx="254" cy="78" r="11" />
            <circle className="path-red" cx="450" cy="155" r="11" />
            <circle className="path-green" cx="351" cy="245" r="11" />
            <text x="85" y="173">Connect</text>
            <text x="254" y="51">Learn</text>
            <text x="450" y="128">Build</text>
            <text x="351" y="218">Share</text>
          </svg>
        </div>
      </section>

      <section className="section surface-section">
        <div className="container">
          <SectionHeading title="최근 활동" action={{ href: "/activities/", label: "모든 활동" }} />
          <ActivityCollection compact />
        </div>
      </section>

      <section className="section container home-projects">
        <ProjectCollection compact />
      </section>

      <section className="section container home-community">
        <SectionHeading title="GDGOC Sahmyook에서 하는 일" action={{ href: "/about/", label: "커뮤니티 소개" }} />
        <div className="value-bento">
          {values.map(([title, text, color]) => (
            <article className={`value-card value-${color}`} key={title}>
              <span className="value-dot" aria-hidden="true" />
              <div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section container people-callout">
        <div>
          <h2>함께 활동하는 구성원</h2>
          <p>서로 다른 관심사와 경험을 가진 학생들이 모여 질문을 나누고 함께 성장합니다.</p>
        </div>
        <Link className="button button-secondary" href="/people/">구성원 보기 <span aria-hidden="true">→</span></Link>
      </section>

      <section className="section container"><RecruitmentProvider><RecruitmentPanel compact /></RecruitmentProvider></section>
    </>
  );
}
