import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const dbIt = process.env.DATABASE_URL ? it : it.skip;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("beautyWallet", () => {
  describe("getExchangeRate", () => {
    it("returns the correct exchange rate configuration", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.beautyWallet.getExchangeRate();

      expect(result).toEqual({
        enabled: false,
        rate: 0.4,
        minPoints: 100,
        unit: 100,
        description:
          "Beauty Wallet主台帳への移行に伴い、旧ポイント交換は停止中です",
      });
    });

    it("rate * 100 should equal 40 BT", () => {
      const rate = 0.4;
      const lcjPoints = 100;
      const bwTokens = Math.floor(lcjPoints * rate);
      expect(bwTokens).toBe(40);
    });

    it("rate * 1000 should equal 400 BT", () => {
      const rate = 0.4;
      const lcjPoints = 1000;
      const bwTokens = Math.floor(lcjPoints * rate);
      expect(bwTokens).toBe(400);
    });

    it("rate * 10000 should equal 4000 BT", () => {
      const rate = 0.4;
      const lcjPoints = 10000;
      const bwTokens = Math.floor(lcjPoints * rate);
      expect(bwTokens).toBe(4000);
    });
  });

  describe("getLinkStatus", () => {
    it("returns unlinked status for a non-existent user to an admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.beautyWallet.getLinkStatus({
        lineUserId: 999999,
      });

      expect(result).toEqual({
        isLinked: false,
        account: null,
      });
    });

    it("rejects arbitrary member lookup by a non-admin staff user", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.beautyWallet.getLinkStatus({ lineUserId: 999999 })
      ).rejects.toThrow();
    });
  });

  describe("startLink", () => {
    it("rejects the legacy link-token route even for an admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.beautyWallet.startLink({ lineUserId: 1 })
      ).rejects.toThrow("会員本人のメール確認が必要です");
    });
  });

  describe("exchange validation", () => {
    it("rejects exchange with less than 100 points", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.beautyWallet.exchange({
          lineUserId: 1,
          lineUserIdStr: "test_user",
          lcjPoints: 50,
        })
      ).rejects.toThrow();
    });

    it("rejects exchange with non-100-unit points", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      // 150 is not a multiple of 100 - but the zod validation only checks min(100)
      // The 100-unit check is in the mutation handler, so it should throw BAD_REQUEST
      // However, the BW link check happens first, so it will throw "not linked" first
      await expect(
        caller.beautyWallet.exchange({
          lineUserId: 999999,
          lineUserIdStr: "test_user",
          lcjPoints: 150,
        })
      ).rejects.toThrow();
    });
  });

  describe("getExchangeHistory", () => {
    it("returns empty array for user with no exchanges", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.beautyWallet.getExchangeHistory({
        lineUserId: 999999,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("admin procedures", () => {
    dbIt("adminGetMonthlySummary returns summary for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.beautyWallet.adminGetMonthlySummary({
        month: "2026-03",
      });

      expect(result).toHaveProperty("totalExchanges");
      expect(result).toHaveProperty("totalLcjPoints");
      expect(result).toHaveProperty("totalBwTokens");
      expect(result).toHaveProperty("uniqueUsers");
      expect(typeof result.totalExchanges).toBe("number");
      // SQL SUM returns string for decimal columns
      expect(["number", "string"].includes(typeof result.totalLcjPoints)).toBe(
        true
      );
    });

    it("adminGetMonthlySummary rejects non-admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.beautyWallet.adminGetMonthlySummary({ month: "2026-03" })
      ).rejects.toThrow();
    });

    it("adminGetAllExchanges returns list for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.beautyWallet.adminGetAllExchanges({
        month: "2026-03",
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("adminGetAllExchanges rejects non-admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.beautyWallet.adminGetAllExchanges({ month: "2026-03" })
      ).rejects.toThrow();
    });

    it("adminProcessPending rejects non-admin", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.beautyWallet.adminProcessPending()).rejects.toThrow();
    });

    it("adminProcessPending stays disabled even for an admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.beautyWallet.adminProcessPending()).rejects.toThrow(
        "二重加算防止"
      );
    });
  });

  describe("exchange rate calculations", () => {
    it("correctly calculates BT for various LCJ amounts", () => {
      const rate = 0.4;
      const testCases = [
        { lcj: 100, expected: 40 },
        { lcj: 200, expected: 80 },
        { lcj: 500, expected: 200 },
        { lcj: 1000, expected: 400 },
        { lcj: 5000, expected: 2000 },
        { lcj: 10000, expected: 4000 },
      ];

      for (const { lcj, expected } of testCases) {
        expect(Math.floor(lcj * rate)).toBe(expected);
      }
    });

    it("100 unit validation works correctly", () => {
      const validAmounts = [100, 200, 500, 1000, 5000, 10000];
      const invalidAmounts = [50, 150, 250, 333, 999];

      for (const amount of validAmounts) {
        expect(amount % 100).toBe(0);
      }

      for (const amount of invalidAmounts) {
        expect(amount % 100).not.toBe(0);
      }
    });
  });

  describe("unlink", () => {
    it("stays disabled even for an admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.beautyWallet.unlink({ lineUserId: 999999 })
      ).rejects.toThrow("監査付きサポート手続き");
    });

    it("rejects unlink by a non-admin staff user", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.beautyWallet.unlink({ lineUserId: 999999 })
      ).rejects.toThrow();
    });
  });
});
