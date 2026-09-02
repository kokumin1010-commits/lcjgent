import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachFollowStaffToScheduleRows,
  calculateFollowDurationMinutes,
  normalizeFollowBroadcastInput,
  normalizeLiverName,
  parseLegacyFollowLiverName,
} from "./staffScheduleFollow";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("staff follow-broadcast time validation", () => {
  it("calculates same-day and overnight duration", () => {
    expect(calculateFollowDurationMinutes("16:35", "19:05")).toBe(150);
    expect(calculateFollowDurationMinutes("23:30", "01:00")).toBe(90);
  });

  it("requires a structured liver identity and both follow times", () => {
    expect(() =>
      normalizeFollowBroadcastInput({
        isFollowBroadcast: true,
        followLiverName: "Ari",
        followStartTime: "20:00",
        followEndTime: "23:00",
      })
    ).toThrow("选择主播");

    expect(() =>
      normalizeFollowBroadcastInput({
        isFollowBroadcast: true,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "20:00",
      })
    ).toThrow("开始时间和结束时间");
  });

  it("rejects less than 15 minutes and more than 16 hours", () => {
    expect(() =>
      normalizeFollowBroadcastInput({
        isFollowBroadcast: true,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "20:00",
        followEndTime: "20:10",
      })
    ).toThrow("不能少于15分钟");

    expect(() =>
      normalizeFollowBroadcastInput({
        isFollowBroadcast: true,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "08:00",
        followEndTime: "01:00",
      })
    ).toThrow("不能超过16小时");
  });

  it("clears all follow metadata when follow mode is off", () => {
    expect(
      normalizeFollowBroadcastInput({
        isFollowBroadcast: false,
        followLiverId: 9,
        followLiverName: "Ari",
        followStartTime: "20:00",
        followEndTime: "23:00",
      })
    ).toEqual({
      isFollowBroadcast: false,
      followLiverId: null,
      followLiverName: null,
      followStartTime: null,
      followEndTime: null,
      followDurationMinutes: null,
    });
  });
});

describe("follow staff attachment to public liver schedules", () => {
  const schedules = [
    {
      id: 10,
      liverId: 1,
      liverName: "Ari",
      startTime: "2026-09-02T11:00:00.000Z",
      endTime: "2026-09-02T14:00:00.000Z",
    },
    {
      id: 11,
      liverId: 2,
      liverName: "Yoko",
      startTime: "2026-09-02T07:35:00.000Z",
      endTime: "2026-09-02T10:05:00.000Z",
    },
  ];

  it("matches by liver ID and overlapping actual follow time", () => {
    const result = attachFollowStaffToScheduleRows(schedules, [
      {
        id: 100,
        staffId: 8,
        staffName: "吴定平",
        dateKey: "2026-09-02",
        notes: "[早班] [跟播] [主播:Ari]",
        isFollowBroadcast: 1,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "20:00",
        followEndTime: "23:00",
      },
      {
        id: 101,
        staffId: 9,
        staffName: "员工B",
        dateKey: "2026-09-02",
        notes: "[早班] [跟播] [主播:Ari]",
        isFollowBroadcast: 1,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "09:00",
        followEndTime: "18:00",
      },
      {
        id: 105,
        staffId: 13,
        staffName: "员工D",
        dateKey: "2026-09-02",
        notes: "[晚班] [跟播] [主播:Ari]",
        isFollowBroadcast: 1,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "21:00",
        followEndTime: "22:30",
      },
    ]);

    expect(result[0].followStaff).toEqual([
      {
        staffName: "员工B",
        startTime: "09:00",
        endTime: "18:00",
        durationMinutes: 540,
        isLegacyTime: false,
      },
      {
        staffName: "吴定平",
        startTime: "20:00",
        endTime: "23:00",
        durationMinutes: 180,
        isLegacyTime: false,
      },
      {
        staffName: "员工D",
        startTime: "21:00",
        endTime: "22:30",
        durationMinutes: 90,
        isLegacyTime: false,
      },
    ]);
    expect(result[1].followStaff).toEqual([]);
  });

  it("falls back to normalized exact liver name without leaking staff to another liver", () => {
    const result = attachFollowStaffToScheduleRows(schedules, [
      {
        id: 102,
        staffId: 10,
        staffName: "员工C",
        dateKey: "2026-09-02",
        notes: "[跟播] [主播:Ａｒｉ]",
        isFollowBroadcast: 1,
        followLiverId: null,
        followLiverName: " Ａｒｉ ",
        followStartTime: "20:30",
        followEndTime: "22:00",
      },
    ]);

    expect(normalizeLiverName(" Ａｒｉ ")).toBe("ari");
    expect(result[0].followStaff).toHaveLength(1);
    expect(result[1].followStaff).toEqual([]);
  });

  it("assigns one follower to only the overlapping occurrence when a liver has multiple streams", () => {
    const repeatedLiverSchedules = [
      {
        id: 20,
        liverId: 1,
        liverName: "Ari",
        startTime: "2026-09-02T01:00:00.000Z",
        endTime: "2026-09-02T03:00:00.000Z",
      },
      {
        id: 21,
        liverId: 1,
        liverName: "Ari",
        startTime: "2026-09-02T11:00:00.000Z",
        endTime: "2026-09-02T14:00:00.000Z",
      },
    ];
    const result = attachFollowStaffToScheduleRows(repeatedLiverSchedules, [
      {
        id: 106,
        staffId: 14,
        staffName: "晚场跟播",
        dateKey: "2026-09-02",
        notes: "[晚班] [跟播] [主播:Ari]",
        isFollowBroadcast: 1,
        followLiverId: 1,
        followLiverName: "Ari",
        followStartTime: "20:30",
        followEndTime: "22:00",
      },
    ]);

    expect(result[0].followStaff).toEqual([]);
    expect(result[1].followStaff).toHaveLength(1);
  });

  it("shows legacy tagged follow staff on the same date without inventing a time", () => {
    const result = attachFollowStaffToScheduleRows(schedules, [
      {
        id: 103,
        staffId: 11,
        staffName: "旧员工",
        dateKey: "2026-09-02",
        notes: "[早班] [跟播] [主播:Yoko]",
        isFollowBroadcast: 0,
        followLiverId: null,
        followLiverName: null,
        followStartTime: null,
        followEndTime: null,
      },
    ]);

    expect(parseLegacyFollowLiverName("[早班] [跟播] [主播:Yoko]")).toBe(
      "Yoko"
    );
    expect(result[1].followStaff).toEqual([
      {
        staffName: "旧员工",
        startTime: null,
        endTime: null,
        durationMinutes: null,
        isLegacyTime: true,
      },
    ]);
  });

  it("supports an overnight follow interval overlapping an overnight stream", () => {
    const overnightSchedule = [
      {
        id: 12,
        liverId: 3,
        liverName: "NANA",
        startTime: "2026-09-02T14:30:00.000Z",
        endTime: "2026-09-02T17:00:00.000Z",
      },
    ];
    const result = attachFollowStaffToScheduleRows(overnightSchedule, [
      {
        id: 104,
        staffId: 12,
        staffName: "夜班员工",
        dateKey: "2026-09-02",
        notes: "[晚班] [跟播] [主播:NANA]",
        isFollowBroadcast: 1,
        followLiverId: 3,
        followLiverName: "NANA",
        followStartTime: "23:30",
        followEndTime: "01:00",
      },
    ]);

    expect(result[0].followStaff[0].durationMinutes).toBe(90);
  });
});

describe("follow-broadcast integration contract", () => {
  const staffPage = read("client/src/pages/StaffSchedule.tsx");
  const publicPage = read("client/src/pages/PublicSchedule.tsx");
  const router = read("server/routers.ts");
  const migration = read("drizzle/0130_structured_follow_broadcast.sql");

  it("keeps work shift and actual follow time as separate form values", () => {
    expect(staffPage).toContain('setFormFollowStartTime("16:00")');
    expect(staffPage).toContain(
      "followStartTime: formIsFollowBroadcast ? formFollowStartTime : null"
    );
    expect(staffPage).toContain(
      "followEndTime: formIsFollowBroadcast ? formFollowEndTime : null"
    );
    expect(staffPage).toContain("勤務時間とは別に、実際に主播へ跟播する時間");
  });

  it("uses liver ID and validates the server-side liver record", () => {
    expect(staffPage).toContain("formAnchorId");
    expect(router).toContain("followLiverId: z.number().nullable().optional()");
    expect(router).toContain(
      "SELECT id, name FROM livers WHERE id = ? AND isActive = 1 LIMIT 1"
    );
  });

  it("attaches only matched follow staff in public schedule responses", () => {
    expect(router).toContain(
      "attachFollowStaffForDateRange(pool, scheduleRows, startDate, endDate)"
    );
    expect(
      publicPage.match(/<FollowStaffBadges assignments=/g)?.length
    ).toBeGreaterThanOrEqual(5);
  });

  it("ships all structured follow-broadcast columns in the deployment migration", () => {
    expect(migration).toContain("ADD COLUMN `isFollowBroadcast`");
    expect(migration).toContain("ADD COLUMN `followLiverId`");
    expect(migration).toContain("ADD COLUMN `followLiverName`");
    expect(migration).toContain("ADD COLUMN `followStartTime`");
    expect(migration).toContain("ADD COLUMN `followEndTime`");
  });
});
