import type { Activity, Project, Recruitment } from "@/types/content";

export const starterActivities: Activity[] = [
  {
    id: "activity-archive-coming-soon",
    slug: "activity-archive-coming-soon",
    title: "첫 활동 기록을 준비하고 있어요",
    summary: "GDGoC Sahmyook의 실제 활동 자료와 사진이 정리되는 대로 이곳에서 소개합니다.",
    category: "Archive",
    status: "준비 중",
    generation: "2026–2027",
    placeholder: true,
  },
];

export const starterProjects: Project[] = [
  {
    id: "project-showcase-coming-soon",
    slug: "project-showcase-coming-soon",
    title: "프로젝트 쇼케이스 준비 중",
    summary: "문제, 해결 과정, 결과가 확인된 팀 프로젝트를 차례로 공개합니다.",
    techStack: [],
    generation: "2026–2027",
    placeholder: true,
  },
];

export const starterRecruitment: Recruitment = {
  id: "2026-2027",
  title: "2026–2027 모집 소식",
  description: "모집 일정과 지원 방법은 공식 채널에서 확정되는 대로 안내합니다.",
  status: "upcoming",
  process: [],
  roles: ["Member", "Team Member"],
  faq: [],
  published: true,
};
