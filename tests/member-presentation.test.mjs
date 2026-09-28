import assert from "node:assert/strict";
import { test } from "node:test";
import { memberRoleForGeneration } from "../src/lib/member-presentation.ts";

test("historical role never inherits today's role without a record", () => {
  const member = {
    id: "one", name: "Example", role: "Organizer", position: "운영",
    generationHistory: [{ generationId: "2026-2", role: "Member", position: "웹" }],
  };
  assert.deepEqual(memberRoleForGeneration(member, "All"), { role: "Organizer", position: "운영" });
  assert.deepEqual(memberRoleForGeneration(member, "2026-2"), { role: "Member", position: "웹" });
  assert.deepEqual(memberRoleForGeneration(member, "2025-2"), { role: "활동 구성원", position: undefined });
  assert.deepEqual(memberRoleForGeneration({ ...member, generationHistory: [null] }, "2026-2"), { role: "활동 구성원", position: undefined });
});
