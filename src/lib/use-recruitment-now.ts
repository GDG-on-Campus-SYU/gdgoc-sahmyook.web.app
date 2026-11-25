"use client";

import { useEffect, useState } from "react";
import { nextRecruitmentTransition, type RecruitmentSchedule } from "./recruitment-status";

export function useRecruitmentNow(schedules: readonly RecruitmentSchedule[]) {
  const [now, setNow] = useState(Date.now);
  const next = schedules.reduce((earliest, schedule) => Math.min(earliest, nextRecruitmentTransition(schedule, now)), Infinity);

  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const refresh = () => setNow(Date.now());
    // Browsers cap timeout delays at a signed 32-bit integer.
    const timeout = window.setTimeout(refresh, Math.max(0, Math.min(next - Date.now(), 2_147_483_647)));
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [next, now]);

  return new Date(now);
}
