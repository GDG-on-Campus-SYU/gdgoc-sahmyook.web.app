export type AdminField = {
  name: string;
  label: string;
  kind?: "text" | "url" | "textarea" | "date" | "number" | "checkbox" | "select" | "list" | "faq" | "generation-list" | "generation-history" | "multi-select";
  required?: boolean;
  options?: string[];
};

export type AdminCollection = {
  name: "activities" | "projects" | "members" | "recruitment" | "generations";
  label: string;
  singular: string;
  titleField: string;
  fields: AdminField[];
};

export const adminCollections: AdminCollection[] = [
  {
    name: "activities", label: "Activities", singular: "활동", titleField: "title",
    fields: [
      { name: "title", label: "활동명", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "summary", label: "요약", kind: "textarea", required: true },
      { name: "content", label: "본문", kind: "textarea" },
      { name: "category", label: "카테고리", kind: "select", required: true, options: ["Study", "Session", "Project", "Networking", "Hackathon", "Collaboration"] },
      { name: "startDate", label: "시작일", kind: "date" },
      { name: "endDate", label: "종료일", kind: "date" },
      { name: "status", label: "상태", kind: "select", required: true, options: ["예정", "진행 중", "종료"] },
      { name: "generation", label: "기수", kind: "select", required: true },
      { name: "host", label: "담당자" },
      { name: "participants", label: "참여 인원" },
      { name: "links", label: "관련 링크 (한 줄에 하나)", kind: "list" },
      { name: "order", label: "표시 순서", kind: "number" },
      { name: "published", label: "공개", kind: "checkbox" },
    ],
  },
  {
    name: "projects", label: "Projects", singular: "프로젝트", titleField: "title",
    fields: [
      { name: "title", label: "프로젝트명", required: true },
      { name: "slug", label: "Slug", required: true },
      { name: "summary", label: "한 줄 소개", kind: "textarea", required: true },
      { name: "description", label: "상세 설명", kind: "textarea" },
      { name: "problem", label: "Problem", kind: "textarea" },
      { name: "solution", label: "Solution", kind: "textarea" },
      { name: "result", label: "Result", kind: "textarea" },
      { name: "members", label: "참여 구성원 (한 줄에 한 명)", kind: "list" },
      { name: "techStack", label: "기술 스택 (한 줄에 하나)", kind: "list" },
      { name: "github", label: "GitHub URL", kind: "url" },
      { name: "demo", label: "Demo URL", kind: "url" },
      { name: "generation", label: "기수", kind: "select", required: true },
      { name: "order", label: "표시 순서", kind: "number" },
      { name: "published", label: "공개", kind: "checkbox" },
    ],
  },
  {
    name: "members", label: "People", singular: "구성원", titleField: "name",
    fields: [
      { name: "name", label: "이름", required: true },
      { name: "role", label: "역할", kind: "select", required: true, options: ["Organizer", "Team Member", "Member"] },
      { name: "position", label: "관심 분야 / 담당" },
      { name: "activityGenerations", label: "활동 기수", kind: "generation-list", required: true },
      { name: "generationHistory", label: "기수별 역할·담당", kind: "generation-history" },
      { name: "description", label: "소개", kind: "textarea" },
      { name: "github", label: "GitHub 프로필 URL", kind: "url" },
      { name: "linkedin", label: "LinkedIn URL", kind: "url" },
      { name: "website", label: "Website URL", kind: "url" },
      { name: "order", label: "표시 순서", kind: "number" },
      { name: "visible", label: "프로필 공개 동의 및 노출", kind: "checkbox" },
    ],
  },
  {
    name: "recruitment", label: "Recruit", singular: "모집", titleField: "title",
    fields: [
      { name: "title", label: "제목", required: true },
      { name: "description", label: "안내", kind: "textarea", required: true },
      { name: "startDate", label: "시작일", kind: "date" },
      { name: "endDate", label: "종료일", kind: "date" },
      { name: "applyUrl", label: "지원 URL", kind: "url" },
      { name: "status", label: "모집 상태", kind: "select", required: true, options: ["upcoming", "open", "closed"] },
      { name: "process", label: "모집 절차 (한 줄에 한 단계)", kind: "list" },
      { name: "roles", label: "모집 역할", kind: "multi-select", options: ["Member", "Team Member"] },
      { name: "faq", label: "자주 묻는 질문", kind: "faq" },
      { name: "published", label: "공개", kind: "checkbox" },
    ],
  },
  {
    name: "generations", label: "Generations", singular: "기수", titleField: "label",
    fields: [
      { name: "label", label: "표시 이름", required: true },
      { name: "order", label: "표시 순서", kind: "number" },
      { name: "published", label: "선택 목록에 공개", kind: "checkbox" },
    ],
  },
];
