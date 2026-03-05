import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-kakuhen",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// ===== Kakuhen Point Calculation Logic Tests =====

/**
 * Mock the kakuhen point calculation logic (same as in routers.ts kakuhen.play)
 */
function calculateKakuhenPoints(orderAmount: number, hasUrl: boolean) {
  const BASE_RATE = 1.0;
  const BOOSTED_RATE = 1.5;
  
  const isKakuhen = hasUrl;
  const rate = isKakuhen ? BOOSTED_RATE : BASE_RATE;
  
  const basePoints = Math.floor(orderAmount * (BASE_RATE / 100));
  let actualPoints: number;
  let bonusPoints: number;
  
  if (isKakuhen) {
    actualPoints = Math.floor(orderAmount * (BOOSTED_RATE / 100));
    bonusPoints = actualPoints - basePoints;
  } else {
    actualPoints = basePoints;
    bonusPoints = 0;
  }
  
  return { isKakuhen, basePoints, actualPoints, bonusPoints, rate };
}

/**
 * Mock the approval logic (same pattern as in routers.ts adminApproveReceipt/adminApproveLineReceipt)
 */
function calculatePointsToAward(
  receiptPointsCalculated: number | null,
  pointsOverride: number | undefined,
  kakuhenResult: { isKakuhen: boolean; actualPoints: number } | null
): { pointsToAward: number; kakuhenApplied: boolean } {
  let pointsToAward = pointsOverride ?? receiptPointsCalculated ?? 0;
  let kakuhenApplied = false;
  
  if (!pointsOverride) {
    if (kakuhenResult && kakuhenResult.isKakuhen && kakuhenResult.actualPoints > 0) {
      pointsToAward = kakuhenResult.actualPoints;
      kakuhenApplied = true;
    }
  }
  
  return { pointsToAward, kakuhenApplied };
}

// ===== tRPC Endpoint Tests =====

describe("kakuhen", () => {
  describe("kakuhen.jackpotWinners", () => {
    it("returns an array (public endpoint)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.kakuhen.jackpotWinners();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("kakuhen.stats", () => {
    it("requires admin role", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      // Regular user should be forbidden
      await expect(caller.kakuhen.stats()).rejects.toThrow("管理者権限が必要です");
    });

    it("returns stats object for admin", async () => {
      const { ctx } = createAuthContext();
      ctx.user!.role = "admin";
      const caller = appRouter.createCaller(ctx);
      const result = await caller.kakuhen.stats();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalPlays");
    });
  });

  describe("kakuhen.allResults", () => {
    it("requires admin role", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.kakuhen.allResults()).rejects.toThrow("管理者権限が必要です");
    });

    it("returns array for admin", async () => {
      const { ctx } = createAuthContext();
      ctx.user!.role = "admin";
      const caller = appRouter.createCaller(ctx);
      const result = await caller.kakuhen.allResults();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("kakuhen.totalReceiptsCount", () => {
    it("requires admin role", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.kakuhen.totalReceiptsCount()).rejects.toThrow("管理者権限が必要です");
    });

    it("returns total count for admin", async () => {
      const { ctx } = createAuthContext();
      ctx.user!.role = "admin";
      const caller = appRouter.createCaller(ctx);
      const result = await caller.kakuhen.totalReceiptsCount();
      expect(result).toHaveProperty("total");
      expect(typeof result.total).toBe("number");
    });
  });
});

// ===== Kakuhen Point Calculation Tests =====

describe("Kakuhen Chance Point Calculation", () => {
  it("should calculate 1% base points without TikTok URL", () => {
    const result = calculateKakuhenPoints(5194, false);
    expect(result.isKakuhen).toBe(false);
    expect(result.basePoints).toBe(51); // Math.floor(5194 * 0.01) = 51
    expect(result.actualPoints).toBe(51);
    expect(result.bonusPoints).toBe(0);
  });

  it("should calculate 1.5% boosted points with TikTok URL (5194円 → 77pt)", () => {
    const result = calculateKakuhenPoints(5194, true);
    expect(result.isKakuhen).toBe(true);
    expect(result.basePoints).toBe(51); // Math.floor(5194 * 0.01) = 51
    expect(result.actualPoints).toBe(77); // Math.floor(5194 * 0.015) = 77
    expect(result.bonusPoints).toBe(26); // 77 - 51 = 26
  });

  it("should calculate correct points for various amounts", () => {
    // 1000円 → 1% = 10pt, 1.5% = 15pt
    const r1 = calculateKakuhenPoints(1000, true);
    expect(r1.basePoints).toBe(10);
    expect(r1.actualPoints).toBe(15);
    expect(r1.bonusPoints).toBe(5);

    // 10000円 → 1% = 100pt, 1.5% = 150pt
    const r2 = calculateKakuhenPoints(10000, true);
    expect(r2.basePoints).toBe(100);
    expect(r2.actualPoints).toBe(150);
    expect(r2.bonusPoints).toBe(50);

    // 3999円 → 1% = 39pt, 1.5% = 59pt
    const r3 = calculateKakuhenPoints(3999, true);
    expect(r3.basePoints).toBe(39);
    expect(r3.actualPoints).toBe(59);
    expect(r3.bonusPoints).toBe(20);
  });
});

// ===== Admin Approval with Kakuhen Points Tests =====

describe("Admin Approval with Kakuhen Points", () => {
  it("should use kakuhen actualPoints (1.5%) when kakuhen result exists and no override", () => {
    const result = calculatePointsToAward(
      51, // receipt.pointsCalculated (1%)
      undefined, // no override
      { isKakuhen: true, actualPoints: 77 } // kakuhen result (1.5%)
    );
    expect(result.pointsToAward).toBe(77);
    expect(result.kakuhenApplied).toBe(true);
  });

  it("should use receipt.pointsCalculated (1%) when no kakuhen result", () => {
    const result = calculatePointsToAward(
      51, // receipt.pointsCalculated (1%)
      undefined, // no override
      null // no kakuhen result
    );
    expect(result.pointsToAward).toBe(51);
    expect(result.kakuhenApplied).toBe(false);
  });

  it("should use pointsOverride when provided, ignoring kakuhen", () => {
    const result = calculatePointsToAward(
      51, // receipt.pointsCalculated (1%)
      100, // admin override
      { isKakuhen: true, actualPoints: 77 } // kakuhen result
    );
    expect(result.pointsToAward).toBe(100);
    expect(result.kakuhenApplied).toBe(false);
  });

  it("should handle non-kakuhen result (URL not provided)", () => {
    const result = calculatePointsToAward(
      51, // receipt.pointsCalculated
      undefined,
      { isKakuhen: false, actualPoints: 51 } // played but no URL
    );
    expect(result.pointsToAward).toBe(51);
    expect(result.kakuhenApplied).toBe(false);
  });

  it("should handle null pointsCalculated with kakuhen", () => {
    const result = calculatePointsToAward(
      null, // no pointsCalculated
      undefined,
      { isKakuhen: true, actualPoints: 77 }
    );
    expect(result.pointsToAward).toBe(77);
    expect(result.kakuhenApplied).toBe(true);
  });

  it("should handle zero actualPoints in kakuhen result", () => {
    const result = calculatePointsToAward(
      51,
      undefined,
      { isKakuhen: true, actualPoints: 0 }
    );
    // actualPoints is 0, so kakuhen should NOT be applied
    expect(result.pointsToAward).toBe(51);
    expect(result.kakuhenApplied).toBe(false);
  });
});

// ===== Receipt Review Tests =====

describe("receiptReview", () => {
  describe("receiptReview.latest", () => {
    it("returns reviews array and totalCount (public endpoint)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.receiptReview.latest();
      expect(result).toHaveProperty("reviews");
      expect(result).toHaveProperty("totalCount");
      expect(Array.isArray(result.reviews)).toBe(true);
      expect(typeof result.totalCount).toBe("number");
    });
  });

  describe("receiptReview.stats", () => {
    it("returns review stats (public endpoint)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.receiptReview.stats();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalReviews");
    });
  });

  describe("receiptReview.productRanking", () => {
    it("returns product ranking array (public endpoint)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.receiptReview.productRanking();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
