import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetail } from "@/components/detail-view";

export const metadata: Metadata = { title: "Project" };
export default function ProjectDetailPage() { return <Suspense fallback={<div className="detail-state container" aria-busy="true">콘텐츠를 불러오는 중입니다.</div>}><ProjectDetail /></Suspense>; }
