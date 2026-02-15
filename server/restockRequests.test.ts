import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
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

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
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

function createAdminContext(): TrpcContext {
  return createUserContext({ id: 1, role: "admin", name: "Admin User" });
}

describe("productRanking router", () => {
  describe("topProducts (public)", () => {
    it("returns an array of products", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.topProducts({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("productName");
        expect(first).toHaveProperty("orderCount");
        expect(first).toHaveProperty("totalAmount");
        expect(first).toHaveProperty("shopName");
        expect(typeof first.orderCount).toBe("number");
        expect(typeof first.totalAmount).toBe("number");
      }
    });

    it("respects the limit parameter", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.topProducts({ limit: 3 });
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("works with no input (defaults)", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.topProducts();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("topBrands (public)", () => {
    it("returns an array of brands", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.topBrands({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("shopName");
        expect(first).toHaveProperty("totalSales");
        expect(first).toHaveProperty("orderCount");
        expect(first).toHaveProperty("productCount");
        expect(typeof first.totalSales).toBe("number");
      }
    });
  });

  describe("brandProducts (public)", () => {
    it("returns products for a given brand", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.brandProducts({
        shopName: "KYOGOKU JAPAN",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("productName");
        expect(first).toHaveProperty("totalSales");
        expect(typeof first.totalSales).toBe("number");
      }
    });

    it("returns empty array for non-existent brand", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.brandProducts({
        shopName: "NON_EXISTENT_BRAND_12345",
      });
      expect(result).toEqual([]);
    });
  });

  describe("requestCounts (public)", () => {
    it("returns an array of request counts", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.productRanking.requestCounts({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("productName");
        expect(result[0]).toHaveProperty("requestCount");
        expect(typeof result[0].requestCount).toBe("number");
      }
    });
  });

  describe("myRequests (protected)", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(caller.productRanking.myRequests()).rejects.toThrow();
    });

    it("returns an array for authenticated user", async () => {
      const caller = appRouter.createCaller(createUserContext());
      const result = await caller.productRanking.myRequests();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("requestRestock (protected)", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.productRanking.requestRestock({
          productName: "Test Product",
        })
      ).rejects.toThrow();
    });

    it("creates a restock request for authenticated user", async () => {
      const caller = appRouter.createCaller(createUserContext());
      const result = await caller.productRanking.requestRestock({
        productName: `Test Product ${Date.now()}`,
        shopName: "Test Shop",
      });
      expect(result).toHaveProperty("alreadyRequested");
      expect(result).toHaveProperty("id");
      expect(result.alreadyRequested).toBe(false);
      expect(typeof result.id).toBe("number");
    });

    it("detects duplicate request", async () => {
      const caller = appRouter.createCaller(createUserContext());
      const productName = `Duplicate Test ${Date.now()}`;
      // First request
      const first = await caller.productRanking.requestRestock({
        productName,
        shopName: "Test Shop",
      });
      expect(first.alreadyRequested).toBe(false);

      // Second request for same product
      const second = await caller.productRanking.requestRestock({
        productName,
        shopName: "Test Shop",
      });
      expect(second.alreadyRequested).toBe(true);
    });
  });

  describe("cancelRequest (protected)", () => {
    it("requires authentication", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      await expect(
        caller.productRanking.cancelRequest({ productName: "Test" })
      ).rejects.toThrow();
    });

    it("cancels a request and allows re-requesting", async () => {
      const caller = appRouter.createCaller(createUserContext());
      const productName = `Cancel Test ${Date.now()}`;

      // Create request
      await caller.productRanking.requestRestock({
        productName,
        shopName: "Test Shop",
      });

      // Cancel it
      const cancelResult = await caller.productRanking.cancelRequest({
        productName,
      });
      expect(cancelResult).toEqual({ success: true });

      // Should be able to request again
      const reRequest = await caller.productRanking.requestRestock({
        productName,
        shopName: "Test Shop",
      });
      expect(reRequest.alreadyRequested).toBe(false);
    });
  });

  describe("adminBrandRequests (admin only)", () => {
    it("rejects non-admin users", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(caller.productRanking.adminBrandRequests()).rejects.toThrow(
        /FORBIDDEN/
      );
    });

    it("returns data for admin users", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.productRanking.adminBrandRequests();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("shopName");
        expect(result[0]).toHaveProperty("totalRequests");
        expect(result[0]).toHaveProperty("uniqueProducts");
        expect(result[0]).toHaveProperty("uniqueUsers");
      }
    });
  });

  describe("adminBrandRequestDetail (admin only)", () => {
    it("rejects non-admin users", async () => {
      const caller = appRouter.createCaller(createUserContext());
      await expect(
        caller.productRanking.adminBrandRequestDetail({
          shopName: "Test Shop",
        })
      ).rejects.toThrow(/FORBIDDEN/);
    });

    it("returns detail data for admin users", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.productRanking.adminBrandRequestDetail({
        shopName: "Test Shop",
      });
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("productName");
        expect(result[0]).toHaveProperty("requestCount");
        expect(result[0]).toHaveProperty("latestRequest");
      }
    });
  });
});
