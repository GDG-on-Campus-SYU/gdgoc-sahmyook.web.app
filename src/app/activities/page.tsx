import type { Metadata } from "next";
import { ActivityCollection } from "@/components/public-content";
import { PageHero } from "@/components/site-shell";

export const metadata: Metadata = { title: "Activities", description: "GDGoC Sahmyook의 스터디, 세션, 네트워킹과 협업 활동을 확인하세요." };

export default function ActivitiesPage() {
  return <><PageHero eyebrow="Activities" title="배우고, 시도하고, 함께 남긴 기록" description="스터디부터 기술 세션, 프로젝트, 네트워킹까지. 과정과 사람을 중심으로 활동을 기록합니다." /><section className="section container"><ActivityCollection /></section></>;
}
