import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-mall",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
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

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user-mall",
    email: "user@example.com",
    name: "Regular User",
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

describe("Mall Admin Tabs - 口コミ管理 & 確変チャンス管理", () => {
  describe("receiptReview.adminSearch (口コミ管理)", () => {
    it("returns paginated reviews for admin", async () => {
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.receiptReview.adminSearch({
        page: 1,
        limit: 10,
        sortBy: "newest",
      });
      expect(result).toHaveProperty("reviews");
      expect(result).toHaveProperty("totalCount");
      expect(Array.isArray(result.reviews)).toBe(true);
      expect(typeof result.totalCount).toBe("number");
    });

    it("supports query search for admin", async () => {
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.receiptReview.adminSearch({
        query: "test",
        page: 1,
        limit: 5,
        sortBy: "highest",
      });
      expect(result).toHaveProperty("reviews");
      expect(Array.isArray(result.reviews)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const { ctx } = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.receiptReview.adminSearch({
          page: 1,
          limit: 10,
          sortBy: "newest",
        })
      ).rejects.toThrow("管理者権限が必要です");
    });
  });

  describe("kakuhen.stats (確変チャンス管理)", () => {
    it("returns admin stats for admin user", async () => {
      const { ctx } = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.kakuhen.stats();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalPlays");
      expect(result).toHaveProperty("kakuhenCount");
      expect(result).toHaveProperty("jackpotCount");
      expect(result).toHaveProperty("avgBoostRate");
      expect(result).toHaveProperty("totalBoostedPoints");
    });

    it("rejects non-admin users", async () => {
      const { ctx } = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.kakuhen.stats()).rejects.toThrow("管理者権限が必要です");
    });
  });
});
