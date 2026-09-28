import type { Recruitment } from "@/types/content";

export function effectiveRecruitmentStatus(
  recruitment: Pick<Recruitment, "status" | "startDate" | "endDate">,
  now = new Date(),
): Recruitment["status"] {
  if (recruitment.status !== "open") return recruitment.status;
  const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (recruitment.startDate && today < recruitment.startDate) return "upcoming";
  if (recruitment.endDate && today > recruitment.endDate) return "closed";
  return "open";
}
