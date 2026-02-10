import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

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
    openId: "normal-user",
    email: "user@example.com",
    name: "Normal User",
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
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("brand.list (shared brands for MALL)", () => {
  it("brand.list is accessible publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brand.list({});
    expect(Array.isArray(result)).toBe(true);
  }, 15000);

  it("brand.list returns brand objects with id and name", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brand.list({});
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
    }
  }, 15000);
});

describe("mall.categories", () => {
  it("getCategoryRecords is accessible publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.getCategoryRecords();
    expect(Array.isArray(result)).toBe(true);
  });

  it("createCategory requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.createCategory({ name: "Test Category", sortOrder: 0, isActive: "yes" })
    ).rejects.toThrow("管理者権限が必要です");
  });

  it("createCategory succeeds for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.createCategory({
      name: "テストカテゴリ",
      slug: "test-category",
      iconEmoji: "🧴",
      sortOrder: 1,
      isActive: "yes",
    });
    expect(result).toEqual({ success: true });
  });

  it("updateCategory requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.updateCategory({ id: 1, name: "Updated" })
    ).rejects.toThrow("管理者権限が必要です");
  });

  it("deleteCategory requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.deleteCategory({ id: 1 })
    ).rejects.toThrow("管理者権限が必要です");
  });
});

describe("mall.products - brand/category fields", () => {
  it("createProduct accepts brandId and categoryId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.createProduct({
      name: "テスト商品",
      price: 1000,
      stock: 10,
      brandId: null,
      categoryId: null,
      status: "draft",
      sortOrder: 0,
    });
    expect(result).toEqual({ success: true });
  });

  it("updateProduct accepts brandId and categoryId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.mall.updateProduct({
        id: 999999,
        brandId: 1,
        categoryId: 2,
      });
    } catch (e: any) {
      expect(e.message).not.toContain("Expected");
    }
  });
});
