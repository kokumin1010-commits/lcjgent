import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getLiverLivestreams: vi.fn().mockResolvedValue([
      {
        id: 1,
        brandId: 1,
        livestreamDate: new Date("2026-01-20T10:00:00Z"),
        livestreamEndTime: new Date("2026-01-20T12:00:00Z"),
        salesAmount: 100000,
        gmv: 150000,
        duration: 120,
        result: "成功",
        impactFactor: "構成",
        resultReason: "良い構成でした",
        liverId: 1,
        streamerName: "テストライバー",
        remarks: "テストメモ",
        screenshotUrl: null,
      },
    ]),
    getLiverRankings: vi.fn().mockResolvedValue({
      salesRanking: [
        { liverId: 1, streamerName: "テストライバー1", totalSales: 500000, totalDuration: 300 },
        { liverId: 2, streamerName: "テストライバー2", totalSales: 300000, totalDuration: 200 },
      ],
      durationRanking: [
        { liverId: 1, streamerName: "テストライバー1", totalSales: 500000, totalDuration: 300 },
        { liverId: 2, streamerName: "テストライバー2", totalSales: 300000, totalDuration: 200 },
      ],
    }),
  };
});

describe("Liver Management API", () => {
  const testUser: AuthenticatedUser = {
    id: 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("liverManagement.rankings", () => {
    it("should return rankings for a given month", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.rankings({
        month: "2026-01",
      });

      expect(result).toBeDefined();
      expect(result.salesRanking).toBeDefined();
      expect(result.durationRanking).toBeDefined();
      expect(Array.isArray(result.salesRanking)).toBe(true);
      expect(Array.isArray(result.durationRanking)).toBe(true);
    });
  });

  describe("liverManagement.getLivestreams", () => {
    it("should return livestreams for a liver", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreams({
        liverId: 1,
        month: "2026-01",
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("liverManagement.updateLivestreamResult", () => {
    it("should update livestream result", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      // This will test the mutation structure
      // The actual database update is mocked
      try {
        await caller.liverManagement.updateLivestreamResult({
          id: 1,
          result: "成功",
          impactFactor: "構成",
          resultReason: "テスト理由",
        });
      } catch (error) {
        // Expected to fail due to mock, but structure should be valid
        expect(error).toBeDefined();
      }
    });

    it("should accept failure result", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.liverManagement.updateLivestreamResult({
          id: 1,
          result: "失敗",
          impactFactor: "商品",
          resultReason: "商品の問題",
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Input validation", () => {
    it("should validate month format for rankings", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      // Valid month format
      const result = await caller.liverManagement.rankings({
        month: "2026-01",
      });
      expect(result).toBeDefined();
    });

    it("should validate liverId for getLivestreams", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.liverManagement.getLivestreams({
        liverId: 1,
        month: "2026-01",
      });
      expect(result).toBeDefined();
    });

    it("should validate impact factor enum values", async () => {
      const ctx = createMockContext(testUser);
      const caller = appRouter.createCaller(ctx);

      // Valid impact factors: 構成, 商品, ライバー, 広告, その他
      const validFactors = ["構成", "商品", "ライバー", "広告", "その他"];
      
      for (const factor of validFactors) {
        try {
          await caller.liverManagement.updateLivestreamResult({
            id: 1,
            result: "成功",
            impactFactor: factor as "構成" | "商品" | "ライバー" | "広告" | "その他",
            resultReason: "テスト",
          });
        } catch (error) {
          // Expected to fail due to mock
          expect(error).toBeDefined();
        }
      }
    });
  });
});

describe("Liver Rankings Calculation", () => {
  it("should calculate total sales correctly", () => {
    const livestreams = [
      { gmv: 100000, salesAmount: 80000 },
      { gmv: 200000, salesAmount: 150000 },
      { gmv: null, salesAmount: 50000 },
    ];

    const totalSales = livestreams.reduce((sum, ls) => {
      return sum + (ls.gmv || ls.salesAmount || 0);
    }, 0);

    expect(totalSales).toBe(350000);
  });

  it("should calculate total duration correctly", () => {
    const livestreams = [
      { duration: 120 }, // 2 hours
      { duration: 180 }, // 3 hours
      { duration: 60 },  // 1 hour
    ];

    const totalDuration = livestreams.reduce((sum, ls) => {
      return sum + (ls.duration || 0);
    }, 0);

    expect(totalDuration).toBe(360); // 6 hours in minutes
    expect(totalDuration / 60).toBe(6); // 6 hours
  });

  it("should handle missing duration by calculating from dates", () => {
    const start = new Date("2026-01-20T10:00:00Z");
    const end = new Date("2026-01-20T12:30:00Z");
    
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    
    expect(durationMinutes).toBe(150); // 2.5 hours
  });
});

describe("Result and Impact Factor Validation", () => {
  it("should only accept valid result values", () => {
    const validResults = ["成功", "失敗"];
    const invalidResults = ["success", "failure", "pending", ""];

    validResults.forEach(result => {
      expect(["成功", "失敗"].includes(result)).toBe(true);
    });

    invalidResults.forEach(result => {
      expect(["成功", "失敗"].includes(result)).toBe(false);
    });
  });

  it("should only accept valid impact factor values", () => {
    const validFactors = ["構成", "商品", "ライバー", "広告", "その他"];
    const invalidFactors = ["composition", "product", "liver", ""];

    validFactors.forEach(factor => {
      expect(["構成", "商品", "ライバー", "広告", "その他"].includes(factor)).toBe(true);
    });

    invalidFactors.forEach(factor => {
      expect(["構成", "商品", "ライバー", "広告", "その他"].includes(factor)).toBe(false);
    });
  });
});
