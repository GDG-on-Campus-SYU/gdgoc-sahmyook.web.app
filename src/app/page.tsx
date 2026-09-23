import Link from "next/link";
import { ActivityCollection, ProjectCollection, RecruitmentPanel } from "@/components/public-content";
import { SectionHeading } from "@/components/site-shell";

const values = [
  ["Learn", "함께 질문하고 깊이 배웁니다.", "blue"],
  ["Build", "아이디어를 실제 서비스로 만듭니다.", "red"],
  ["Share", "배운 것과 경험을 아낌없이 나눕니다.", "green"],
  ["Connect", "학생과 개발자 커뮤니티를 연결합니다.", "yellow"],
] as const;

export default function Home() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Google Developer Groups · On Campus Sahmyook</p>
          <h1><span>Connect.</span><span>Learn. Build.</span><span>Together.</span></h1>
          <p className="hero-lede">삼육대학교에서 기술을 배우는 것을 넘어, 함께 만들고 경험을 나누는 학생 개발자 커뮤니티입니다.</p>
          <div className="button-row">
            <Link className="button" href="/about">Explore GDGoC <span aria-hidden="true">→</span></Link>
            <Link className="button button-secondary" href="/recruit">Join us <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className="hero-map" aria-hidden="true">
          <span className="map-label label-a">LEARN</span>
          <span className="map-label label-b">BUILD</span>
          <span className="map-label label-c">SHARE</span>
          <span className="map-label label-d">CONNECT</span>
          <i className="node node-a" /><i className="node node-b" /><i className="node node-c" /><i className="node node-d" />
          <svg viewBox="0 0 600 560" role="presentation">
            <path className="path-blue" d="M40 410 C160 410 130 135 285 135" />
            <path className="path-red" d="M285 135 C425 135 395 300 550 300" />
            <path className="path-green" d="M120 495 C300 495 245 300 550 300" />
            <path className="path-yellow" d="M40 410 C200 410 260 470 470 470" />
          </svg>
          <div className="map-center"><strong>SYU</strong><span>37.6425° N</span></div>
        </div>
      </section>

      <section className="section about-intro">
        <div className="container intro-grid">
          <p className="eyebrow">About GDGoC</p>
          <div>
            <h2>혼자 배우는 기술을<br />함께 성장하는 경험으로.</h2>
            <p>GDG on Campus는 대학생이 기술을 탐구하고, 동료와 결과물을 만들며, 더 넓은 개발자 커뮤니티와 연결되는 프로그램입니다.</p>
            <Link className="text-link" href="/about">커뮤니티 알아보기 <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="section container">
        <SectionHeading eyebrow="What we do" title="배움이 결과물이 되는 네 가지 방식" description="GDGoC Sahmyook의 활동은 배우고, 만들고, 나누고, 연결되는 하나의 흐름입니다." />
        <div className="value-bento">
          {values.map(([title, text, color], index) => (
            <article className={`value-card value-${color} value-${index + 1}`} key={title}>
              <span className="value-dot" />
              <div><h3>{title}</h3><p>{text}</p></div>
              <span className="value-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section surface-section">
        <div className="container">
          <SectionHeading eyebrow="Featured activities" title="우리가 함께한 장면들" description="실제 활동과 배움의 과정을 기록합니다." action={{ href: "/activities", label: "모든 활동" }} />
          <ActivityCollection compact />
        </div>
      </section>

      <section className="section container">
        <SectionHeading eyebrow="Projects" title="아이디어를 세상에 꺼내놓는 일" description="문제에서 시작해 작동하는 결과물에 도달한 프로젝트를 소개합니다." action={{ href: "/projects", label: "프로젝트 보기" }} />
        <ProjectCollection compact />
      </section>

      <section className="section container people-callout">
        <div>
          <p className="eyebrow">People make community</p>
          <h2>코드보다 먼저,<br />사람을 연결합니다.</h2>
        </div>
        <div>
          <p>서로 다른 관심사와 경험을 가진 구성원이 질문을 나누고 함께 성장합니다. 공개에 동의한 구성원의 이야기를 만나보세요.</p>
          <Link className="button button-secondary" href="/people">Meet the community <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="section container"><RecruitmentPanel compact /></section>
    </>
  );
}
