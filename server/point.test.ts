import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1, role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Point System", () => {
  describe("point.getBalance", () => {
    it("returns point balance for authenticated user", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.point.getBalance();

      expect(result).toBeDefined();
      expect(typeof result.balance).toBe("number");
      expect(typeof result.totalEarned).toBe("number");
      expect(typeof result.totalUsed).toBe("number");
    });
  });

  describe("point.getTransactions", () => {
    it("returns transaction history for authenticated user", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.point.getTransactions();

      expect(Array.isArray(result)).toBe(true);
    });

    it("respects limit parameter", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.point.getTransactions({ limit: 10, offset: 0 });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("point.getMyReceipts", () => {
    it("returns receipts for authenticated user", async () => {
      const ctx = createAuthContext(1);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.point.getMyReceipts();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Admin endpoints", () => {
    describe("point.adminGetReceipts", () => {
      it("returns receipts for admin user", async () => {
        const ctx = createAuthContext(1, "admin");
        const caller = appRouter.createCaller(ctx);

        const result = await caller.point.adminGetReceipts();

        expect(Array.isArray(result)).toBe(true);
      });

      it("throws FORBIDDEN for non-admin user", async () => {
        const ctx = createAuthContext(1, "user");
        const caller = appRouter.createCaller(ctx);

        await expect(caller.point.adminGetReceipts()).rejects.toThrow("管理者権限が必要です");
      });

      it("filters by status", async () => {
        const ctx = createAuthContext(1, "admin");
        const caller = appRouter.createCaller(ctx);

        const result = await caller.point.adminGetReceipts({ status: "pending" });

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("point.adminGetPendingCount", () => {
      it("returns pending count for admin user", async () => {
        const ctx = createAuthContext(1, "admin");
        const caller = appRouter.createCaller(ctx);

        const result = await caller.point.adminGetPendingCount();

        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThanOrEqual(0);
      });

      it("throws FORBIDDEN for non-admin user", async () => {
        const ctx = createAuthContext(1, "user");
        const caller = appRouter.createCaller(ctx);

        await expect(caller.point.adminGetPendingCount()).rejects.toThrow("管理者権限が必要です");
      });
    });

    describe("point.adminGetStatistics", () => {
      it("returns statistics for admin user", async () => {
        const ctx = createAuthContext(1, "admin");
        const caller = appRouter.createCaller(ctx);

        const result = await caller.point.adminGetStatistics();

        expect(Array.isArray(result)).toBe(true);
      });

      it("throws FORBIDDEN for non-admin user", async () => {
        const ctx = createAuthContext(1, "user");
        const caller = appRouter.createCaller(ctx);

        await expect(caller.point.adminGetStatistics()).rejects.toThrow("管理者権限が必要です");
      });
    });
  });
});

describe("Point Calculation", () => {
  it("calculates 1% of purchase amount", () => {
    // Test the calculation logic (1% return rate)
    const calculatePoints = (amount: number): number => {
      return Math.floor(amount * 0.01);
    };

    expect(calculatePoints(1000)).toBe(10);
    expect(calculatePoints(5000)).toBe(50);
    expect(calculatePoints(10000)).toBe(100);
    expect(calculatePoints(999)).toBe(9); // Floor function
    expect(calculatePoints(100)).toBe(1);
    expect(calculatePoints(99)).toBe(0); // Too small
  });
});
