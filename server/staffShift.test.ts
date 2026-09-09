import { describe, expect, it } from "vitest";
import {
  detectStaffShiftKey,
  notesHaveStaffShift,
  normalizeStaffShiftTimeRange,
  STAFF_SHIFT_PRESETS,
  stripStaffShiftTags,
  tryGetStaffShiftTimeRange,
} from "../shared/staffShift";

describe("staff shift presets", () => {
  it("defines the four requested working shifts exactly", () => {
    expect(STAFF_SHIFT_PRESETS.regular).toMatchObject({ label: "普通班次", start: "09:00", end: "18:00", endsNextDay: false });
    expect(STAFF_SHIFT_PRESETS.afternoon).toMatchObject({ label: "下午班次", start: "15:00", end: "23:00", endsNextDay: false });
    expect(STAFF_SHIFT_PRESETS.night).toMatchObject({ label: "夜班班次", start: "18:00", end: "02:00", endsNextDay: true });
    expect(STAFF_SHIFT_PRESETS.midday).toMatchObject({ label: "凌晨班次", start: "13:00", end: "18:00", endsNextDay: false });
  });
});

describe("staff shift time ranges", () => {
  it.each([
    ["09:00", "18:00", 9 * 60, false],
    ["15:00", "23:00", 8 * 60, false],
    ["18:00", "02:00", 8 * 60, true],
    ["13:00", "18:00", 5 * 60, false],
  ])("calculates %s-%s safely", (start, end, durationMinutes, endsNextDay) => {
    expect(normalizeStaffShiftTimeRange(start, end)).toEqual({
      startTime: start,
      endTime: end,
      durationMinutes,
      endsNextDay,
    });
  });

  it("treats an equal end time as next-day 24 hours rather than zero or negative", () => {
    expect(normalizeStaffShiftTimeRange("09:00", "09:00")).toMatchObject({ durationMinutes: 24 * 60, endsNextDay: true });
  });

  it.each([["24:00", "02:00"], ["18:00", "2:00"], ["invalid", "18:00"], ["", "18:00"]])(
    "rejects invalid HH:MM input %s-%s",
    (start, end) => {
      expect(() => normalizeStaffShiftTimeRange(start, end)).toThrow("HH:MM");
      expect(tryGetStaffShiftTimeRange(start, end)).toBeNull();
    },
  );
});

describe("staff shift tags", () => {
  it("recognizes new canonical tags", () => {
    expect(detectStaffShiftKey("[普通班次] 备注")).toBe("regular");
    expect(detectStaffShiftKey("[下午班次]")).toBe("afternoon");
    expect(detectStaffShiftKey("[夜班班次]")).toBe("night");
    expect(detectStaffShiftKey("[凌晨班次]")).toBe("midday");
  });

  it("keeps historical 早班 and 晚班 records compatible", () => {
    expect(notesHaveStaffShift("[早班]", "regular")).toBe(true);
    expect(notesHaveStaffShift("[晚班]", "afternoon")).toBe(true);
    expect(detectStaffShiftKey("[早班] [跟播]")).toBe("regular");
    expect(detectStaffShiftKey("[晚班]")).toBe("afternoon");
  });

  it("removes canonical and legacy shift tags without deleting free notes", () => {
    expect(stripStaffShiftTags("[夜班班次] 盘点 [跟播]")).toBe("盘点 [跟播]");
    expect(stripStaffShiftTags("[早班] 任务A")).toBe("任务A");
  });
});
