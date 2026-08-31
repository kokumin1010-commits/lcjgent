import { describe, expect, it, vi } from "vitest";
import {
  calculateShortVideoAccountSalesMetrics,
  calculateShortVideoEngagementMetrics,
  getDefaultShortVideoReportDate,
  getMonthBounds,
  getTokyoToday,
  isFutureTokyoDate,
  normalizeShortVideoUrl,
} from "../shared/shortVideoDaily";
import {
  resolveShortVideoDailyAccess,
  shortVideoDailyEntryInputSchema,
} from "./shortVideoDailyRouter";
import {
  resolveShortVideoAccountDailyAccess,
  shortVideoAccountDailySalesInputSchema,
} from "./shortVideoAccountDailyRouter";

describe("short video daily business rules", () => {
  it("defaults to the previous Tokyo business date", () => {
    const now = new Date("2026-08-31T00:32:00.000Z");
    expect(getTokyoToday(now)).toBe("2026-08-31");
    expect(getDefaultShortVideoReportDate(now)).toBe("2026-08-30");
  });

  it("rejects future business dates but accepts today and historical dates", () => {
    const now = new Date("2026-08-31T00:32:00.000Z");
    expect(isFutureTokyoDate("2026-08-31", now)).toBe(false);
    expect(isFutureTokyoDate("2026-08-30", now)).toBe(false);
    expect(isFutureTokyoDate("2026-09-01", now)).toBe(true);
    expect(isFutureTokyoDate("2026-02-30", now)).toBe(true);
  });

  it("calculates video engagement without any order or GMV attribution", () => {
    const summary = calculateShortVideoEngagementMetrics([
      {
        views: 1000,
        likes: 80,
        comments: 10,
        shares: 5,
        saves: 5,
        productClicks: 40,
      },
      {
        views: 500,
        likes: 20,
        comments: 4,
        shares: 3,
        saves: 3,
        productClicks: 10,
      },
    ]);
    expect(summary).toMatchObject({
      postCount: 2,
      views: 1500,
      likes: 100,
      engagements: 130,
      productClicks: 50,
    });
    expect(summary.engagementRate).toBeCloseTo(130 / 1500);
    expect(summary.clickRate).toBeCloseTo(50 / 1500);
    expect(summary).not.toHaveProperty("orders");
    expect(summary).not.toHaveProperty("gmv");
  });

  it("calculates account-day sales independently from video rows", () => {
    const summary = calculateShortVideoAccountSalesMetrics([
      {
        reportDate: "2026-08-30",
        accountId: 1,
        responsibleStaffId: 10,
        orders: 12,
        gmv: 98000,
      },
      {
        reportDate: "2026-08-30",
        accountId: 2,
        responsibleStaffId: 10,
        orders: 5,
        gmv: "21000.50",
      },
      {
        reportDate: "2026-08-29",
        accountId: 1,
        responsibleStaffId: 11,
        orders: 3,
        gmv: 9000,
      },
    ]);
    expect(summary).toEqual({
      recordCount: 3,
      activeDays: 2,
      accountCount: 2,
      responsibleCount: 2,
      orders: 20,
      gmv: 128000.5,
    });
  });

  it("builds exact month bounds including leap years", () => {
    expect(getMonthBounds("2026-08")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    expect(getMonthBounds("2028-02")).toEqual({
      startDate: "2028-02-01",
      endDate: "2028-02-29",
    });
    expect(() => getMonthBounds("2026-13")).toThrow("invalid month");
  });

  it("normalizes tracking parameters without changing video identity", () => {
    expect(
      normalizeShortVideoUrl(
        "HTTPS://WWW.TIKTOK.COM/@LCJ/video/123/?utm_source=line&fbclid=x#share"
      )
    ).toBe("https://www.tiktok.com/@LCJ/video/123");
    expect(() => normalizeShortVideoUrl("javascript:alert(1)")).toThrow(
      "http or https"
    );
  });

  it("accepts only video engagement fields and strips legacy sales input", () => {
    const base = {
      reportDate: "2026-08-30",
      videoUrl: "https://www.tiktok.com/@lcj/video/1",
      producerStaffId: 1,
      views: 100,
      likes: 10,
      comments: 1,
      shares: 1,
      saves: 1,
      productClicks: 5,
    };
    const parsed = shortVideoDailyEntryInputSchema.parse({
      ...base,
      orders: 999,
      gmv: 999999,
      currency: "JPY",
    });
    expect(parsed).not.toHaveProperty("orders");
    expect(parsed).not.toHaveProperty("gmv");
    expect(parsed).not.toHaveProperty("currency");
    expect(
      shortVideoDailyEntryInputSchema.safeParse({ ...base, likes: -1 }).success
    ).toBe(false);
    expect(
      shortVideoDailyEntryInputSchema.safeParse({
        ...base,
        reportDate: "2999-01-01",
      }).success
    ).toBe(false);
  });

  it("validates account daily orders and GMV separately", () => {
    const base = {
      reportDate: "2026-08-30",
      accountId: 1,
      responsibleStaffId: 2,
      orders: 5,
      gmv: 12800.5,
      currency: "JPY" as const,
      notes: "TikTok Shop后台",
    };
    expect(shortVideoAccountDailySalesInputSchema.safeParse(base).success).toBe(
      true
    );
    expect(
      shortVideoAccountDailySalesInputSchema.safeParse({
        ...base,
        orders: -1,
      }).success
    ).toBe(false);
    expect(
      shortVideoAccountDailySalesInputSchema.safeParse({
        ...base,
        gmv: -0.01,
      }).success
    ).toBe(false);
    expect(
      shortVideoAccountDailySalesInputSchema.safeParse({
        ...base,
        reportDate: "2999-01-01",
      }).success
    ).toBe(false);
  });
});

function roleConnection(canView: number, canEdit: number) {
  return {
    query: vi
      .fn()
      .mockResolvedValueOnce([[{ roleId: 3 }], []])
      .mockResolvedValueOnce([[{ canView, canEdit }], []]),
  } as any;
}

describe("short video daily RBAC", () => {
  it("grants admins both video and account-sales edit access", async () => {
    const videoConnection = { query: vi.fn() } as any;
    const salesConnection = { query: vi.fn() } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 1, role: "admin" } },
        videoConnection
      )
    ).resolves.toEqual({ canView: true, canEdit: true });
    await expect(
      resolveShortVideoAccountDailyAccess(
        { user: { id: 1, role: "admin" } },
        salesConnection
      )
    ).resolves.toEqual({ canView: true, canEdit: true });
    expect(videoConnection.query).not.toHaveBeenCalled();
    expect(salesConnection.query).not.toHaveBeenCalled();
  });

  it("denies both data areas when staff has no assigned role", async () => {
    const videoConnection = {
      query: vi.fn().mockResolvedValueOnce([[], []]),
    } as any;
    const salesConnection = {
      query: vi.fn().mockResolvedValueOnce([[], []]),
    } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 2, role: "user" } },
        videoConnection
      )
    ).resolves.toEqual({ canView: false, canEdit: false });
    await expect(
      resolveShortVideoAccountDailyAccess(
        { user: { id: 2, role: "user" } },
        salesConnection
      )
    ).resolves.toEqual({ canView: false, canEdit: false });
  });

  it("keeps view and edit permissions identical across both areas", async () => {
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 3, role: "user" } },
        roleConnection(1, 0)
      )
    ).resolves.toEqual({ canView: true, canEdit: false });
    await expect(
      resolveShortVideoAccountDailyAccess(
        { user: { id: 3, role: "user" } },
        roleConnection(1, 0)
      )
    ).resolves.toEqual({ canView: true, canEdit: false });
    await expect(
      resolveShortVideoAccountDailyAccess(
        { user: { id: 4, role: "user" } },
        roleConnection(0, 1)
      )
    ).resolves.toEqual({ canView: true, canEdit: true });
  });
});
