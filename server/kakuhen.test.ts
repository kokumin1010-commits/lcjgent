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
});

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
