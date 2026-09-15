import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getScheduleDayState,
  sortSchedulesForDate,
} from "../client/src/lib/publicScheduleTime";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const jstIso = (date: string, time: string) =>
  new Date(`${date}T${time}:00+09:00`).toISOString();

describe("public schedule daily time ordering", () => {
  it("sorts the screenshot sample by the visible start time", () => {
    const schedules = [
      { id: 1, startTime: jstIso("2026-09-08", "15:00") },
      { id: 2, startTime: jstIso("2026-09-08", "09:00") },
      { id: 3, startTime: jstIso("2026-09-08", "12:00") },
      { id: 4, startTime: jstIso("2026-09-08", "16:00") },
      {
        id: 5,
        startTime: jstIso("2026-09-08", "20:00"),
        endTime: jstIso("2026-09-09", "02:00"),
      },
    ];

    expect(
      sortSchedulesForDate(schedules, "2026-09-08").map(item => item.id)
    ).toEqual([2, 3, 1, 4, 5]);
  });

  it("places a carried-over overnight stream at midnight on its second day", () => {
    const overnight = {
      id: 5,
      startTime: jstIso("2026-09-08", "20:00"),
      endTime: jstIso("2026-09-09", "02:00"),
    };
    const morning = {
      id: 6,
      startTime: jstIso("2026-09-09", "09:00"),
      endTime: jstIso("2026-09-09", "12:00"),
    };

    const state = getScheduleDayState(
      overnight,
      "2026-09-09",
      new Date(jstIso("2026-09-09", "01:00"))
    );

    expect(state.isMultiDay).toBe(true);
    expect(state.isStartDay).toBe(false);
    expect(state.isEndDay).toBe(true);
    expect(state.displayStart.toISOString()).toBe(
      jstIso("2026-09-09", "00:00")
    );
    expect(state.displayEnd?.toISOString()).toBe(jstIso("2026-09-09", "02:00"));
    expect(state.isEnded).toBe(false);
    expect(
      sortSchedulesForDate([morning, overnight], "2026-09-09").map(
        item => item.id
      )
    ).toEqual([5, 6]);
  });

  it("marks an overnight stream ended immediately after its real end time", () => {
    const overnight = {
      id: 5,
      startTime: jstIso("2026-09-08", "20:00"),
      endTime: jstIso("2026-09-09", "02:00"),
    };

    expect(
      getScheduleDayState(
        overnight,
        "2026-09-09",
        new Date(jstIso("2026-09-09", "01:59"))
      ).isEnded
    ).toBe(false);
    expect(
      getScheduleDayState(
        overnight,
        "2026-09-09",
        new Date(jstIso("2026-09-09", "02:00"))
      ).isEnded
    ).toBe(true);
  });

  it("keeps all-day schedules before timed schedules and uses id as a stable tie-breaker", () => {
    const schedules = [
      { id: 3, startTime: jstIso("2026-09-08", "09:00") },
      { id: 2, startTime: jstIso("2026-09-08", "09:00") },
      { id: 4, startTime: jstIso("2026-09-08", "18:00"), isAllDay: true },
    ];

    expect(
      sortSchedulesForDate(schedules, "2026-09-08").map(item => item.id)
    ).toEqual([4, 2, 3]);
  });
});

describe("public schedule ended-state UI contract", () => {
  it("uses the shared day-state in all views and visibly marks ended schedules", () => {
    const page = read("client/src/pages/PublicSchedule.tsx");

    expect(page).toContain("sortSchedulesForDate(daySchedules, dateKey)");
    expect(
      page.match(/getScheduleDayState\(schedule, dateKey, currentTime\)/g)
        ?.length
    ).toBeGreaterThanOrEqual(4);
    expect(page.match(/終了済み/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page.match(/前日から/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain('isEnded ? "#D1D5DB"');
    expect(page).toContain('isEnded ? "#9CA3AF"');
    expect(page).toContain(
      "formatTimeRangeJST(scheduleState.displayStart, scheduleState.displayEnd)"
    );
  });
});
