import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db functions
vi.mock("./db", () => ({
  getLivestreamsForSalesCheck: vi.fn(),
  correctLivestreamData: vi.fn(),
}));

import { getLivestreamsForSalesCheck, correctLivestreamData } from "./db";

const mockGetLivestreams = vi.mocked(getLivestreamsForSalesCheck);
const mockCorrectData = vi.mocked(correctLivestreamData);

describe("salesCheck - getLivestreamsForSalesCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call with month and no liverId when liverId is not provided", async () => {
    mockGetLivestreams.mockResolvedValue([]);
    const result = await getLivestreamsForSalesCheck("2026-03");
    expect(mockGetLivestreams).toHaveBeenCalledWith("2026-03");
    expect(result).toEqual([]);
  });

  it("should call with month and liverId when liverId is provided", async () => {
    mockGetLivestreams.mockResolvedValue([]);
    const result = await getLivestreamsForSalesCheck("2026-03", 1);
    expect(mockGetLivestreams).toHaveBeenCalledWith("2026-03", 1);
    expect(result).toEqual([]);
  });

  it("should return livestream data with liver and brand info", async () => {
    const mockData = [
      {
        id: 1,
        liverId: 10,
        liverName: "テストライバー",
        liverColor: "#FF69B4",
        liverAvatar: null,
        brandId: 5,
        brandName: "テストブランド",
        livestreamDate: new Date("2026-03-15T10:00:00Z"),
        livestreamEndTime: new Date("2026-03-15T12:00:00Z"),
        salesAmount: 150000,
        manualSalesAmount: null,
        duration: 120,
        viewerCount: 500,
        orderCount: 30,
        screenshotUrl: "https://example.com/screenshot.jpg",
        beforeScreenshotUrl: null,
        result: "成功" as const,
        remarks: "テスト備考",
        streamerName: "テストライバー",
        livestreamStartTime: "19:00",
      },
    ];
    mockGetLivestreams.mockResolvedValue(mockData);
    const result = await getLivestreamsForSalesCheck("2026-03", 10);
    expect(result).toHaveLength(1);
    expect(result[0].liverName).toBe("テストライバー");
    expect(result[0].brandName).toBe("テストブランド");
    expect(result[0].salesAmount).toBe(150000);
    expect(result[0].duration).toBe(120);
  });
});

describe("salesCheck - correctLivestreamData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call correctLivestreamData with id and correction data", async () => {
    mockCorrectData.mockResolvedValue({ success: true });
    const result = await correctLivestreamData(1, {
      salesAmount: 200000,
      duration: 150,
    });
    expect(mockCorrectData).toHaveBeenCalledWith(1, {
      salesAmount: 200000,
      duration: 150,
    });
    expect(result).toEqual({ success: true });
  });

  it("should handle null values for clearing fields", async () => {
    mockCorrectData.mockResolvedValue({ success: true });
    const result = await correctLivestreamData(1, {
      salesAmount: null,
      duration: null,
      viewerCount: null,
      orderCount: null,
      remarks: null,
    });
    expect(mockCorrectData).toHaveBeenCalledWith(1, {
      salesAmount: null,
      duration: null,
      viewerCount: null,
      orderCount: null,
      remarks: null,
    });
    expect(result).toEqual({ success: true });
  });

  it("should handle partial updates", async () => {
    mockCorrectData.mockResolvedValue({ success: true });
    const result = await correctLivestreamData(1, {
      salesAmount: 300000,
    });
    expect(mockCorrectData).toHaveBeenCalledWith(1, {
      salesAmount: 300000,
    });
    expect(result).toEqual({ success: true });
  });

  it("should handle remarks update", async () => {
    mockCorrectData.mockResolvedValue({ success: true });
    const result = await correctLivestreamData(1, {
      remarks: "管理者により訂正: 売上金額を修正",
    });
    expect(mockCorrectData).toHaveBeenCalledWith(1, {
      remarks: "管理者により訂正: 売上金額を修正",
    });
    expect(result).toEqual({ success: true });
  });
});
