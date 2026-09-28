import type { Member } from "@/types/content";

export function memberRoleForGeneration(member: Member, generation: string) {
  if (generation === "All") return { role: member.role, position: member.position };
  const history = member.generationHistory?.find((item) => item && typeof item === "object" && item.generationId === generation);
  const role = history && ["Organizer", "Team Member", "Member"].includes(history.role) ? history.role : "활동 구성원";
  return { role, position: role === "활동 구성원" ? undefined : history?.position };
}
