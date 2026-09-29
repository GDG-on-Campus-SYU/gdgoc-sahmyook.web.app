import type { Metadata } from "next";
import { ProjectCollection } from "@/components/public-content";
import { PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "Projects", description: "GDGOC Sahmyook 구성원이 문제를 발견하고 해결한 프로젝트를 소개합니다.", alternates: { canonical: "/projects/" } };

export default function ProjectsPage() {
  return <><PageHero eyebrow="Projects" title="문제에서 시작해, 작동하는 결과물까지" description="기술 목록보다 왜 만들었는지, 어떻게 해결했는지, 무엇을 배웠는지를 먼저 보여줍니다." /><section className="section container"><ProjectCollection /></section></>;
}
