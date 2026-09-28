import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityDetail } from "@/components/detail-view";

export const metadata: Metadata = { title: "Activity", robots: { index: false, follow: true } };
export default function ActivityDetailPage() { return <Suspense fallback={<div className="detail-state container" aria-busy="true">콘텐츠를 불러오는 중입니다.</div>}><ActivityDetail /></Suspense>; }
