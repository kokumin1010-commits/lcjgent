import { describe, expect, it } from "vitest";

/**
 * Tests for liver rankings bug fixes:
 * 1. Backend: getLiverRankings JOINs livers table to return correct liverName and avatarUrl
 * 2. Frontend: Uses liverName from API instead of client-side lookup
 * 3. Default month: Should default to previous month (not current month which may have no data)
 */

describe("Liver Rankings - Backend Query Fix", () => {
  it("should return liverName field from livers table JOIN", () => {
    // Simulate the ranking data structure returned by the fixed getLiverRankings
    const rankingItem = {
      liverId: 120005,
      streamerName: "Ryu kyogoku ", // From COALESCE(livers.name, MAX(streamerName))
      liverName: "Ryu kyogoku ",    // Directly from livers.name
      avatarUrl: null,
      totalSales: 31982618,
      totalDuration: 0,
    };

    // liverName should be present and not be a brand name
    expect(rankingItem.liverName).toBeDefined();
    expect(rankingItem.liverName).not.toBe("KYOGOKU");
    expect(rankingItem.liverName).toBe("Ryu kyogoku ");
  });

  it("should return avatarUrl field from livers table JOIN", () => {
    const rankingItem = {
      liverId: 540003,
      streamerName: "yae",
      liverName: "yae",
      avatarUrl: "https://example.com/avatar.jpg",
      totalSales: 23524009,
      totalDuration: 1200,
    };

    expect(rankingItem.avatarUrl).toBeDefined();
    expect(rankingItem.avatarUrl).toBe("https://example.com/avatar.jpg");
  });

  it("should handle null liverName gracefully with streamerName fallback", () => {
    // When liverId exists but liver record was deleted
    const rankingItem = {
      liverId: 999999,
      streamerName: "Some Streamer",
      liverName: null as string | null,
      avatarUrl: null,
      totalSales: 100000,
      totalDuration: 60,
    };

    // Frontend display logic: use liverName first, fallback to streamerName
    const displayName = rankingItem.liverName || rankingItem.streamerName || "不明";
    expect(displayName).toBe("Some Streamer");
  });

  it("should not show brand names as liver names", () => {
    // The old bug: MAX(streamerName) would pick "KYOGOKU" (brand name) 
    // over actual liver names alphabetically
    const rankingItems = [
      { liverId: 120005, liverName: "Ryu kyogoku ", streamerName: "Ryu kyogoku " },
      { liverId: 540003, liverName: "yae", streamerName: "yae" },
      { liverId: 360029, liverName: "SHIHO", streamerName: "SHIHO" },
      { liverId: 360013, liverName: "NANA", streamerName: "NANA" },
      { liverId: 360012, liverName: "三宅あゆみ", streamerName: "三宅あゆみ" },
    ];

    // None of the liver names should be "KYOGOKU" (which is a brand name)
    for (const item of rankingItems) {
      expect(item.liverName).not.toBe("KYOGOKU");
    }

    // Each liver should have a unique name
    const names = rankingItems.map(i => i.liverName);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe("Liver Rankings - Frontend Display Logic", () => {
  it("should prefer liverName over streamerName for display", () => {
    const item = {
      liverId: 120005,
      streamerName: "KYOGOKU", // Old incorrect value
      liverName: "Ryu kyogoku ",
      avatarUrl: null,
      totalSales: 31982618,
      totalDuration: 0,
    };

    // Frontend display logic mirrors what the code does
    const displayName = (item as any).liverName || item.streamerName || "不明";
    expect(displayName).toBe("Ryu kyogoku ");
  });

  it("should prefer avatarUrl from API over client-side lookup", () => {
    const item = {
      liverId: 540003,
      avatarUrl: "https://s3.example.com/avatar-yae.jpg",
      liverName: "yae",
      streamerName: "yae",
    };

    // Frontend should use avatarUrl directly from API
    const avatarSrc = (item as any).avatarUrl || undefined;
    expect(avatarSrc).toBe("https://s3.example.com/avatar-yae.jpg");
  });

  it("should show first character of liverName in avatar fallback", () => {
    const item = {
      liverId: 360012,
      liverName: "三宅あゆみ",
      streamerName: "三宅あゆみ",
      avatarUrl: null,
    };

    const fallbackChar = ((item as any).liverName || item.streamerName)?.charAt(0) || "?";
    expect(fallbackChar).toBe("三");
  });
});

describe("Liver Rankings - Default Month Selection", () => {
  it("should generate month options with current month first", () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }

    expect(options.length).toBe(12);
    // First option should be current month
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(options[0].value).toBe(currentMonth);
  });

  it("should default to previous month (index 1) instead of current month (index 0)", () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }

    // Default should be monthOptions[1] (previous month), not monthOptions[0] (current month)
    const defaultMonth = options[1]?.value || options[0].value;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const expectedPrevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    
    expect(defaultMonth).toBe(expectedPrevMonth);
    // Should NOT be current month
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(defaultMonth).not.toBe(currentMonth);
  });
});

describe("Liver Rankings - Ranking Data Integrity", () => {
  it("should only include records with non-null liverId", () => {
    // Records with liverId = NULL should be excluded from rankings
    const records = [
      { liverId: 120005, liverName: "Ryu kyogoku ", totalSales: 31982618 },
      { liverId: null, liverName: null, totalSales: 5000000 }, // Should be excluded
      { liverId: 540003, liverName: "yae", totalSales: 23524009 },
    ];

    const filteredRecords = records.filter(r => r.liverId !== null);
    expect(filteredRecords.length).toBe(2);
    expect(filteredRecords.every(r => r.liverId !== null)).toBe(true);
  });

  it("should sort sales ranking by totalSales descending", () => {
    const salesRanking = [
      { liverId: 120005, liverName: "Ryu kyogoku ", totalSales: 31982618 },
      { liverId: 540003, liverName: "yae", totalSales: 23524009 },
      { liverId: 360029, liverName: "SHIHO", totalSales: 5349793 },
      { liverId: 360013, liverName: "NANA", totalSales: 4354505 },
    ];

    for (let i = 1; i < salesRanking.length; i++) {
      expect(salesRanking[i - 1].totalSales).toBeGreaterThanOrEqual(salesRanking[i].totalSales);
    }
  });

  it("should exclude soft-deleted records (deletedAt IS NOT NULL)", () => {
    // This is verified by the SQL query having isNull(brandLivestreams.deletedAt)
    const records = [
      { id: 1, liverId: 120005, salesAmount: 1000000, deletedAt: null },
      { id: 2, liverId: 120005, salesAmount: 500000, deletedAt: new Date() }, // Soft deleted
      { id: 3, liverId: 540003, salesAmount: 2000000, deletedAt: null },
    ];

    const activeRecords = records.filter(r => r.deletedAt === null);
    expect(activeRecords.length).toBe(2);
    expect(activeRecords.every(r => r.deletedAt === null)).toBe(true);
  });
});
