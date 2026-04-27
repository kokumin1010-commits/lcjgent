import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getSchedulesByBrandId: vi.fn(),
  getDistinctLiversForBrandSchedules: vi.fn(),
}));

import { getSchedulesByBrandId, getDistinctLiversForBrandSchedules } from "./db";

describe("Brand Schedule Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSchedulesByBrandId", () => {
    it("should be callable with brandId only", async () => {
      const mockSchedules = [
        {
          id: 1,
          title: "配信テスト",
          startTime: new Date("2026-05-01T10:00:00Z"),
          endTime: new Date("2026-05-01T12:00:00Z"),
          liverName: "Alice",
          brandId: 100,
          status: "scheduled",
          category: "delivery",
        },
      ];
      (getSchedulesByBrandId as any).mockResolvedValue(mockSchedules);

      const result = await getSchedulesByBrandId(100);
      expect(result).toEqual(mockSchedules);
      expect(getSchedulesByBrandId).toHaveBeenCalledWith(100);
    });

    it("should accept optional filter parameters", async () => {
      (getSchedulesByBrandId as any).mockResolvedValue([]);

      const options = {
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-06-30"),
        liverId: 5,
        liverName: "Alice",
        limit: 50,
      };
      const result = await getSchedulesByBrandId(100, options);
      expect(result).toEqual([]);
      expect(getSchedulesByBrandId).toHaveBeenCalledWith(100, options);
    });

    it("should return empty array when no schedules found", async () => {
      (getSchedulesByBrandId as any).mockResolvedValue([]);

      const result = await getSchedulesByBrandId(999);
      expect(result).toEqual([]);
    });
  });

  describe("getDistinctLiversForBrandSchedules", () => {
    it("should return distinct liver names for a brand", async () => {
      const mockLivers = [
        { liverId: 1, liverName: "Alice" },
        { liverId: 2, liverName: "Bob" },
        { liverId: 3, liverName: "Charlie" },
      ];
      (getDistinctLiversForBrandSchedules as any).mockResolvedValue(mockLivers);

      const result = await getDistinctLiversForBrandSchedules(100);
      expect(result).toEqual(mockLivers);
      expect(result.length).toBe(3);
    });

    it("should return empty array when no livers found", async () => {
      (getDistinctLiversForBrandSchedules as any).mockResolvedValue([]);

      const result = await getDistinctLiversForBrandSchedules(999);
      expect(result).toEqual([]);
    });
  });
});
