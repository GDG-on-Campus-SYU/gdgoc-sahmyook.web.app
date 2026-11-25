import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveRecruitmentStatus, nextRecruitmentTransition, validRecruitmentEndTime } from "../src/lib/recruitment-status.ts";

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

test("the application closes at the specified Korean minute, including midnight", () => {
  const schedule = { status: "open", endDate: "2026-09-12", endTime: "18:00" };
  const deadline = Date.parse("2026-09-12T09:00:00Z");
  assert.equal(effectiveRecruitmentStatus(schedule, new Date(deadline - 1)), "open");
  assert.equal(effectiveRecruitmentStatus(schedule, new Date(deadline)), "closed");
  assert.equal(effectiveRecruitmentStatus(schedule, new Date(deadline + 1)), "closed");
  assert.equal(effectiveRecruitmentStatus({ ...schedule, endTime: "00:00" }, new Date("2026-09-11T15:00:00Z")), "closed");
  assert.equal(effectiveRecruitmentStatus({ ...schedule, endTime: "" }, new Date(deadline)), "open");
});

test("open pages update at the next KST boundary and manual states do not schedule a transition", () => {
  const schedule = { status: "open", startDate: "2026-09-01", endDate: "2026-09-12", endTime: "18:00" };
  const start = Date.parse("2026-08-31T15:00:00Z");
  const deadline = Date.parse("2026-09-12T09:00:00Z");
  assert.equal(nextRecruitmentTransition(schedule, start - 1), start);
  assert.equal(nextRecruitmentTransition(schedule, start), deadline);
  assert.equal(nextRecruitmentTransition(schedule, deadline), Infinity);
  assert.equal(nextRecruitmentTransition({ ...schedule, endTime: "" }, start), Date.parse("2026-09-12T15:00:00Z"));
  for (const status of ["upcoming", "closed"]) {
    assert.equal(nextRecruitmentTransition({ ...schedule, status }, start), Infinity);
    assert.equal(effectiveRecruitmentStatus({ ...schedule, status }, new Date(deadline + 1)), status);
  }
});

test("a custom cutoff needs a date and a valid 24-hour minute", () => {
  assert.equal(validRecruitmentEndTime("", ""), true);
  assert.equal(validRecruitmentEndTime("", "18:00"), false);
  for (const time of ["00:00", "18:00", "23:59"]) assert.equal(validRecruitmentEndTime("2026-09-12", time), true);
  for (const time of ["24:00", "12:60", "7:30"]) assert.equal(validRecruitmentEndTime("2026-09-12", time), false);
});
