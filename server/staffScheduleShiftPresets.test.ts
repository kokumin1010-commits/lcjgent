import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const page = readFileSync(`${here}/../client/src/pages/StaffSchedule.tsx`, "utf8");
const routers = readFileSync(`${here}/routers.ts`, "utf8");
const competitor = readFileSync(`${here}/tiktokCompetitorDailyRouter.ts`, "utf8");

describe("staff schedule four-shift UI contract", () => {
  it("shows all requested presets and keeps leave", () => {
    expect(page).toContain('handleShiftChange("regular")');
    expect(page).toContain('handleShiftChange("afternoon")');
    expect(page).toContain('handleShiftChange("night")');
    expect(page).toContain('handleShiftChange("midday")');
    expect(page).toContain('handleShiftChange("leave")');
    expect(page).toContain("普通班次 09:00-18:00");
    expect(page).toContain("下午班次 15:00-23:00");
    expect(page).toContain("夜班班次 18:00-次日02:00");
    expect(page).toContain("凌晨班次 13:00-18:00");
  });

  it("filters and summarizes all four working shifts", () => {
    for (const key of ["regular", "afternoon", "night", "midday"]) {
      expect(page).toContain(`<SelectItem value="${key}">`);
      expect(page).toContain(`shiftCounts.${key}`);
    }
    expect(page).toContain("notesHaveStaffShift");
    expect(page).not.toContain('formShift === "morning"');
    expect(page).not.toContain('formShift === "evening"');
  });

  it("explains and displays next-day night shifts", () => {
    expect(page).toContain('workTimeRange?.endsNextDay ? "次日 "');
    expect(page).toContain("終了は次日扱いです");
    expect(page).toContain('shiftTimeRange?.endsNextDay ? `次日 ${s.endTime}`');
    expect(page).toContain("!workTimeIsValid");
  });

  it("exports all four shift counters", () => {
    expect(page).toContain('"普通班次", "下午班次", "夜班班次", "凌晨班次"');
    expect(page).toContain("s.regularCount");
    expect(page).toContain("s.afternoonCount");
    expect(page).toContain("s.nightCount");
    expect(page).toContain("s.middayCount");
  });
});

describe("staff schedule server safety contract", () => {
  it("validates create, update and batch time ranges with the shared helper", () => {
    expect((routers.match(/normalizeStaffShiftTimeRange\(/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(routers).toContain("workTime.startTime");
    expect(routers).toContain("workTime.endTime");
  });

  it("returns four counters while accepting historical labels", () => {
    expect(routers).toContain("regularCount: 0");
    expect(routers).toContain("afternoonCount: 0");
    expect(routers).toContain("nightCount: 0");
    expect(routers).toContain("middayCount: 0");
    expect(routers).toContain("notesHaveStaffShift(notes, 'regular')");
  });

  it("keeps the competitor task available to new regular and legacy morning shifts", () => {
    expect(competitor).toContain("ss.notes LIKE '%[普通班次]%'");
    expect(competitor).toContain("ss.notes LIKE '%[早班]%'");
  });
});
