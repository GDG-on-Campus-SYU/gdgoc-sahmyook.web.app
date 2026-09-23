import type { Metadata } from "next";
import { PeopleCollection } from "@/components/public-content";
import { PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "People", description: "GDGoC Sahmyook을 함께 만드는 구성원을 소개합니다." };

export default function PeoplePage() {
  return (
    <>
      <PageHero eyebrow="People · 2026–2027" title="커뮤니티를 만드는 사람들" description="프로필과 외부 링크는 본인이 공개에 동의한 경우에만 표시합니다." />
      <section className="section container role-strip" aria-label="구성원 역할">
        <article><span>01</span><h2>Organizer</h2><p>챕터의 방향과 운영을 책임집니다.</p></article>
        <article><span>02</span><h2>Team Member</h2><p>프로그램과 커뮤니티 경험을 설계합니다.</p></article>
        <article><span>03</span><h2>Member</h2><p>배우고 만들며 경험을 함께 나눕니다.</p></article>
      </section>
      <section className="section surface-section"><div className="container"><PeopleCollection /></div></section>
    </>
  );
}
