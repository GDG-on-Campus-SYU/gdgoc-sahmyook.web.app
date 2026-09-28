import type { Metadata } from "next";
import { PeopleCollection, PeopleHero } from "@/components/public-content";

export const metadata: Metadata = { title: "People", description: "GDGoC Sahmyook을 함께 만드는 구성원을 소개합니다.", alternates: { canonical: "/people/" } };

export default function PeoplePage() {
  return (
    <>
      <PeopleHero />
      <section className="section container role-strip" aria-label="구성원 역할">
        <article><span>01</span><h2>Organizer</h2><p>챕터의 방향과 운영을 책임집니다.</p></article>
        <article><span>02</span><h2>Team Member</h2><p>프로그램과 커뮤니티 경험을 설계합니다.</p></article>
        <article><span>03</span><h2>Member</h2><p>배우고 만들며 경험을 함께 나눕니다.</p></article>
      </section>
      <section className="section surface-section"><div className="container"><PeopleCollection /></div></section>
    </>
  );
}
