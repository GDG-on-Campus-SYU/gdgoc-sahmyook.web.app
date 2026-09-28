import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveRecruitmentStatus } from "../src/lib/recruitment-status.ts";

test("Korean start and end dates are inclusive", () => {
  const recruitment = { status: "open", startDate: "2026-10-01", endDate: "2026-10-03" };
  assert.equal(effectiveRecruitmentStatus(recruitment, new Date("2026-09-30T14:59:59Z")), "upcoming");
  assert.equal(effectiveRecruitmentStatus(recruitment, new Date("2026-09-30T15:00:00Z")), "open");
  assert.equal(effectiveRecruitmentStatus(recruitment, new Date("2026-10-03T14:59:59Z")), "open");
  assert.equal(effectiveRecruitmentStatus(recruitment, new Date("2026-10-03T15:00:00Z")), "closed");
});

test("manual status controls recruitment when no dates are set", () => {
  assert.equal(effectiveRecruitmentStatus({ status: "open" }), "open");
  assert.equal(effectiveRecruitmentStatus({ status: "closed", startDate: "2026-10-01" }), "closed");
  assert.equal(effectiveRecruitmentStatus({ status: "upcoming", endDate: "2026-09-01" }), "upcoming");
});
