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

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
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

describe("mall.getRecommendedProducts", () => {
  it("returns products for unauthenticated users (popular products fallback)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getRecommendedProducts({ limit: 8 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(8);
  }, 30000);

  it("returns products for authenticated users", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getRecommendedProducts({ limit: 8 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(8);
  }, 30000);

  it("respects the limit parameter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result4 = await caller.mall.getRecommendedProducts({ limit: 4 });

    expect(result4.length).toBeLessThanOrEqual(4);
  }, 30000);

  it("returns products with expected fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getRecommendedProducts({ limit: 4 });

    if (result.length > 0) {
      const product = result[0];
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("name");
      expect(product).toHaveProperty("price");
      expect(product).toHaveProperty("status");
      for (const p of result) {
        expect(p.status).toBe("active");
      }
    }
  }, 30000);
});

describe("mall.getPopularProducts", () => {
  it("returns popular products for public access", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getPopularProducts({ limit: 8 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(8);
  }, 30000);

  it("returns products with order count information", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getPopularProducts({ limit: 4 });

    if (result.length > 0) {
      const product = result[0];
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("name");
      expect(product).toHaveProperty("price");
      expect(product).toHaveProperty("orderCount");
    }
  }, 30000);

  it("returns products sorted by order count descending", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getPopularProducts({ limit: 10 });

    if (result.length > 1) {
      for (let i = 0; i < result.length - 1; i++) {
        expect(Number(result[i].orderCount)).toBeGreaterThanOrEqual(Number(result[i + 1].orderCount));
      }
    }
  }, 30000);

  it("respects the limit parameter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.mall.getPopularProducts({ limit: 3 });

    expect(result.length).toBeLessThanOrEqual(3);
  }, 30000);
});
