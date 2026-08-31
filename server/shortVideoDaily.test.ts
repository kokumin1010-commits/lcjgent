import { describe, expect, it, vi } from "vitest";
import {
  calculateShortVideoDailyMetrics,
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

  it("calculates posts, engagement, clicks, orders and GMV from link rows", () => {
    const summary = calculateShortVideoDailyMetrics([
      {
        views: 1000,
        likes: 80,
        comments: 10,
        shares: 5,
        saves: 5,
        productClicks: 40,
        orders: 4,
        gmv: 12000,
      },
      {
        views: 500,
        likes: 20,
        comments: 4,
        shares: 3,
        saves: 3,
        productClicks: 10,
        orders: 1,
        gmv: "3500.50",
      },
    ]);
    expect(summary).toMatchObject({
      postCount: 2,
      views: 1500,
      likes: 100,
      engagements: 130,
      productClicks: 50,
      orders: 5,
      gmv: 15500.5,
    });
    expect(summary.engagementRate).toBeCloseTo(130 / 1500);
    expect(summary.clickRate).toBeCloseTo(50 / 1500);
    expect(summary.clickConversionRate).toBeCloseTo(5 / 50);
    expect(summary.viewConversionRate).toBeCloseTo(5 / 1500);
  });

  it("does not invent a click conversion rate when clicks are unavailable", () => {
    const summary = calculateShortVideoDailyMetrics([
      { views: 100, productClicks: 0, orders: 2, gmv: 5000 },
    ]);
    expect(summary.clickConversionRate).toBeNull();
    expect(summary.viewConversionRate).toBeCloseTo(0.02);
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

  it("normalizes tracking parameters without changing the video identity", () => {
    expect(
      normalizeShortVideoUrl(
        "HTTPS://WWW.TIKTOK.COM/@LCJ/video/123/?utm_source=line&fbclid=x#share"
      )
    ).toBe("https://www.tiktok.com/@LCJ/video/123");
    expect(() => normalizeShortVideoUrl("javascript:alert(1)")).toThrow(
      "http or https"
    );
  });

  it("validates non-negative metrics and conversion boundaries", () => {
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
      orders: 2,
      gmv: 3000,
      currency: "JPY" as const,
    };
    expect(shortVideoDailyEntryInputSchema.safeParse(base).success).toBe(true);
    expect(
      shortVideoDailyEntryInputSchema.safeParse({ ...base, likes: -1 }).success
    ).toBe(false);
    expect(
      shortVideoDailyEntryInputSchema.safeParse({
        ...base,
        productClicks: 1,
        orders: 2,
      }).success
    ).toBe(false);
    expect(
      shortVideoDailyEntryInputSchema.safeParse({
        ...base,
        productClicks: 0,
        orders: 2,
      }).success
    ).toBe(true);
    expect(
      shortVideoDailyEntryInputSchema.safeParse({
        ...base,
        reportDate: "2999-01-01",
      }).success
    ).toBe(false);
  });
});

describe("short video daily RBAC", () => {
  it("grants admins view and edit without querying custom roles", async () => {
    const connection = { query: vi.fn() } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 1, role: "admin" } },
        connection
      )
    ).resolves.toEqual({ canView: true, canEdit: true });
    expect(connection.query).not.toHaveBeenCalled();
  });

  it("denies staff without an assigned role", async () => {
    const connection = {
      query: vi.fn().mockResolvedValueOnce([[], []]),
    } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 2, role: "user" } },
        connection
      )
    ).resolves.toEqual({ canView: false, canEdit: false });
  });

  it("keeps canView and canEdit distinct", async () => {
    const viewConnection = {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ roleId: 3 }], []])
        .mockResolvedValueOnce([[{ canView: 1, canEdit: 0 }], []]),
    } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 3, role: "user" } },
        viewConnection
      )
    ).resolves.toEqual({ canView: true, canEdit: false });

    const editConnection = {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ roleId: 4 }], []])
        .mockResolvedValueOnce([[{ canView: 0, canEdit: 1 }], []]),
    } as any;
    await expect(
      resolveShortVideoDailyAccess(
        { user: { id: 4, role: "user" } },
        editConnection
      )
    ).resolves.toEqual({ canView: true, canEdit: true });
  });
});
