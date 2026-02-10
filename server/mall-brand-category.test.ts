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

describe("mall.brands", () => {
  it("getBrands is accessible publicly", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.getBrands();
    expect(Array.isArray(result)).toBe(true);
  });

  it("createBrand requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.createBrand({ name: "Test Brand", sortOrder: 0, isActive: "yes" })
    ).rejects.toThrow("管理者権限が必要です");
  });

  it("createBrand succeeds for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.createBrand({
      name: "テストブランド",
      nameEn: "Test Brand",
      sortOrder: 1,
      isActive: "yes",
    });
    expect(result).toEqual({ success: true });
  });

  it("createBrand with linkedBrandId succeeds for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.createBrand({
      name: "紐付けテストブランド",
      linkedBrandId: 1,
      sortOrder: 2,
      isActive: "yes",
    });
    expect(result).toEqual({ success: true });
  });

  it("createBrand with null linkedBrandId succeeds for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mall.createBrand({
      name: "紐付けなしブランド",
      linkedBrandId: null,
      sortOrder: 3,
      isActive: "yes",
    });
    expect(result).toEqual({ success: true });
  });

  it("updateBrand with linkedBrandId succeeds for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const brands = await caller.mall.getBrands();
    if (brands.length > 0) {
      const result = await caller.mall.updateBrand({
        id: brands[0].id,
        linkedBrandId: 1,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("updateBrand can clear linkedBrandId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const brands = await caller.mall.getBrands();
    if (brands.length > 0) {
      const result = await caller.mall.updateBrand({
        id: brands[0].id,
        linkedBrandId: null,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("updateBrand requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.updateBrand({ id: 1, name: "Updated" })
    ).rejects.toThrow("管理者権限が必要です");
  });

  it("deleteBrand requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mall.deleteBrand({ id: 1 })
    ).rejects.toThrow("管理者権限が必要です");
  });
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
    // This should not throw a validation error for the new fields
    // (actual DB update may fail if product doesn't exist, but input validation should pass)
    try {
      await caller.mall.updateProduct({
        id: 999999,
        brandId: 1,
        categoryId: 2,
      });
    } catch (e: any) {
      // DB error is expected since product 999999 doesn't exist
      // but it should NOT be a validation error
      expect(e.message).not.toContain("Expected");
    }
  });
});
