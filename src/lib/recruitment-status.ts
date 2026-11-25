import type { Recruitment } from "@/types/content";

export type RecruitmentSchedule = Pick<Recruitment, "status" | "startDate" | "endDate" | "endTime">;

export const recruitmentStatusLabels: Record<Recruitment["status"], string> = {
  upcoming: "모집 예정",
  open: "모집 중",
  closed: "모집 종료",
};

export function validRecruitmentEndTime(endDate: string, endTime: string) {
  return !endTime || (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(endDate) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime));
}

function boundaries({ startDate, endDate, endTime }: RecruitmentSchedule) {
  const start = startDate ? Date.parse(`${startDate}T00:00:00+09:00`) : -Infinity;
  // With no cutoff time the public notice includes the whole last day in Korea.
  const end = endDate ? Date.parse(`${endDate}T${endTime || "24:00"}:00+09:00`) : Infinity;
  return { start, end };
}

export function effectiveRecruitmentStatus(schedule: RecruitmentSchedule, now = new Date()): Recruitment["status"] {
  if (schedule.status !== "open") return schedule.status;
  const { start, end } = boundaries(schedule);
  if (now.getTime() < start) return "upcoming";
  if (now.getTime() >= end) return "closed";
  return "open";
}

export function nextRecruitmentTransition(schedule: RecruitmentSchedule, now: number) {
  if (schedule.status !== "open") return Infinity;
  const { start, end } = boundaries(schedule);
  if (now < start) return start;
  return now < end ? end : Infinity;
}
