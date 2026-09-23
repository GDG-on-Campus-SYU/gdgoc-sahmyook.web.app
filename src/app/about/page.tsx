import type { Metadata } from "next";
import { BrandLogo, PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "About", description: "GDG on Campus와 GDGoC Sahmyook이 추구하는 커뮤니티를 소개합니다." };

const values = [
  ["Respect", "서로 다른 배경과 경험을 존중합니다."],
  ["Share", "알고 있는 것과 시행착오를 함께 나눕니다."],
  ["Challenge", "실패를 두려워하지 않고 새로운 시도를 합니다."],
  ["Together", "혼자보다 함께 성장하는 경험을 중요하게 생각합니다."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About us" title="기술로 만나고, 경험으로 이어지는 커뮤니티" description="GDGoC Sahmyook은 삼육대학교 학생들이 함께 배우고 만들며 개발자 생태계와 연결되는 학생 커뮤니티입니다." />
      <section className="section container editorial-grid">
        <p className="eyebrow">What is GDG on Campus?</p>
        <div>
          <h2>학교 안의 배움을<br />더 넓은 세상과 연결합니다.</h2>
          <p>Google Developer Groups on Campus는 대학생이 다양한 기술을 탐구하고, 동료와 프로젝트를 만들고, 개발자 커뮤니티와 교류할 수 있도록 돕는 프로그램입니다.</p>
          <p>GDGoC Sahmyook은 이 기반 위에서 삼육대학교 구성원에게 지속 가능한 학습과 협업의 장을 만듭니다.</p>
          <div className="program-logo"><BrandLogo variant="gdgocHorizontal" /></div>
        </div>
      </section>
      <section className="section surface-section">
        <div className="container">
          <div className="section-heading"><div><p className="eyebrow">Community values</p><h2>함께할 때 지키는 약속</h2></div></div>
          <div className="principle-list">
            {values.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>
      <section className="section container identity-statement">
        <p className="eyebrow">Our identity</p>
        <blockquote>“실제 구성원, 실제 활동, 실제 결과물이<br />GDGoC Sahmyook의 정체성이 됩니다.”</blockquote>
        <p>이 웹사이트는 활동이 끝나도 기록이 사라지지 않고 다음 구성원에게 이어지는 커뮤니티 아카이브를 지향합니다.</p>
      </section>
    </>
  );
}
